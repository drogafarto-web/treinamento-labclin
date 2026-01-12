
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { JobRole, TrainingModule, Frequency } from '../types';
import { TABLES } from '../constants/tables';
import { getErrorMessage } from '../lib/errorUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrainingModulePlayer } from './TrainingModulePlayer';

// Helpers de Conversão
const getFrequencyFromMonths = (m: number | null): Frequency => {
  if (m === null) return Frequency.ONCE;
  if (m === 6) return Frequency.BIANNUAL;
  if (m === 12) return Frequency.ANNUAL;
  if (m === 36) return Frequency.EVERY_3_YEARS;
  return Frequency.ANNUAL;
};

const getMonthsFromFrequency = (f: Frequency): number | null => {
  switch (f) {
    case Frequency.ONCE: return null;
    case Frequency.BIANNUAL: return 6;
    case Frequency.ANNUAL: return 12;
    case Frequency.EVERY_3_YEARS: return 36;
    default: return 12;
  }
};

export const TrainingMatrix: React.FC = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [requirements, setRequirements] = useState<Record<string, { is_mandatory: boolean, frequency: Frequency }>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  
  // State for Player Preview
  const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<{ id?: string, name: string, is_critical: boolean }>({ name: '', is_critical: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rData, error: rErr } = await supabase.from(TABLES.ROLES).select('*').order('name');
      if (rErr) throw rErr;

      const { data: mData, error: mErr } = await supabase.from(TABLES.MODULES).select('*').order('title');
      if (mErr) throw mErr;

      const { data: reqData, error: reqErr } = await supabase.from(TABLES.REQUIREMENTS).select('*');
      
      const reqMap: Record<string, any> = {};
      reqData?.forEach((req: any) => {
        reqMap[`${req.role_id}-${req.module_id}`] = {
          is_mandatory: req.is_mandatory,
          frequency: getFrequencyFromMonths(req.recertification_period_months)
        };
      });

      setRoles(rData || []);
      setModules(mData || []);
      setRequirements(reqMap);
      
      if (!selectedRoleId && rData?.length > 0) {
        setSelectedRoleId(rData[0].id);
      }
    } catch (e) {
      console.error('Fetch Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      console.group(`Exclusão de Cargo: ${roleId}`);
      
      // 1. Verificar Colaboradores (Dependência Principal)
      console.log('Passo 1: Verificando tabela employees...');
      const { count: empCount, error: empError } = await supabase
        .from(TABLES.EMPLOYEES)
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleId);
      
      if (empError) console.warn('Erro ao verificar employees (RLS):', empError);
      if (empCount && empCount > 0) {
        console.groupEnd();
        throw new Error(`BLOQUEIO: Existem ${empCount} colaboradores vinculados a este cargo. Remova o cargo deles antes de excluir.`);
      }

      // 2. Limpar Requisitos da Matriz
      console.log('Passo 2: Limpando requisitos na tabela training_role_requirements...');
      const { error: reqsError } = await supabase
        .from(TABLES.REQUIREMENTS)
        .delete()
        .eq('role_id', roleId);
      
      if (reqsError) {
        console.error('Falha no Passo 2:', reqsError);
        console.groupEnd();
        throw reqsError;
      }

      // 3. Excluir o Cargo
      console.log('Passo 3: Excluindo o cargo na tabela roles...');
      const { error: roleError, status } = await supabase
        .from(TABLES.ROLES)
        .delete()
        .eq('id', roleId);
      
      if (roleError) {
        console.error('Falha no Passo 3:', roleError);
        console.groupEnd();
        throw roleError;
      }

      console.log(`Sucesso! Status do banco: ${status}`);
      console.groupEnd();
      return roleId;
    },
    onSuccess: (deletedId) => {
      if (selectedRoleId === deletedId) setSelectedRoleId(null);
      alert('✅ Cargo removido com sucesso!');
      fetchData();
    },
    onError: (error: any) => {
      console.error("Erro Completo capturado:", error);
      alert(`❌ Falha na exclusão:\n${getErrorMessage(error)}`);
    }
  });

  const handleDeleteRole = (e: React.MouseEvent, role: JobRole) => {
    e.stopPropagation();
    if (window.confirm(`AVISO RDC 978: Você está prestes a excluir o cargo "${role.name}".\n\nIsso apagará todas as exigências da matriz vinculadas a ele. Confirmar?`)) {
      deleteRoleMutation.mutate(role.id);
    }
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { 
        name: roleForm.name, 
        is_critical_function: roleForm.is_critical 
      };
      const { error } = roleForm.id 
        ? await supabase.from(TABLES.ROLES).update(payload).eq('id', roleForm.id)
        : await supabase.from(TABLES.ROLES).insert(payload);

      if (error) throw error;
      setIsRoleModalOpen(false);
      fetchData();
    } catch (e) {
      alert(`Falha ao salvar: ${getErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const upsertData = modules.map(m => {
        const req = requirements[`${selectedRoleId}-${m.id}`];
        return {
          role_id: selectedRoleId,
          module_id: m.id,
          is_mandatory: !!req?.is_mandatory,
          recertification_period_months: req?.is_mandatory ? getMonthsFromFrequency(req.frequency) : null
        };
      });

      const { error } = await supabase
        .from(TABLES.REQUIREMENTS)
        .upsert(upsertData, { onConflict: 'role_id,module_id' });

      if (error) throw error;
      alert('✅ Matriz salva!');
    } catch (e) {
      alert(`Erro: ${getErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-indigo-600 font-bold">Sincronizando Matriz...</div>;

  const currentRole = roles.find(r => r.id === selectedRoleId);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col h-[90vh]">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Matriz de Treinamento</h1>
          <p className="text-slate-500 text-sm">Gestão de Competência RDC 978</p>
        </div>
        <button 
          onClick={handleSaveMatrix}
          disabled={saving || !selectedRoleId}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-all active:scale-95"
        >
          {saving ? 'Salvando...' : 'Salvar Matriz'}
        </button>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar: Cargos */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargos / Funções</span>
            <button 
              onClick={() => { setRoleForm({ name: '', is_critical: false }); setIsRoleModalOpen(true); }}
              className="text-indigo-600 text-xs font-bold hover:underline"
            >
              + NOVO
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {roles.map(role => (
              <div 
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`group px-4 py-4 flex justify-between items-center cursor-pointer transition-colors ${selectedRoleId === role.id ? 'bg-indigo-50 border-r-4 border-indigo-600' : 'hover:bg-slate-50'}`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className={`text-sm truncate ${selectedRoleId === role.id ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>
                    {role.name}
                  </p>
                  {role.is_critical_function && <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded font-black uppercase">Crítico</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setRoleForm({ id: role.id, name: role.name, is_critical: role.is_critical_function }); setIsRoleModalOpen(true); }} className="p-1 hover:text-indigo-600" title="Editar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={(e) => handleDeleteRole(e, role)} className="p-1 hover:text-red-600" title="Excluir">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Matriz de Treinamento */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {currentRole ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 font-bold text-slate-500 uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4 w-16 text-center">Exigir</th>
                    <th className="px-6 py-4">Módulo de Treinamento</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Periodicidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modules.map(module => {
                    const req = requirements[`${selectedRoleId}-${module.id}`];
                    const isMandatory = !!req?.is_mandatory;
                    return (
                      <tr key={module.id} className={`transition-colors ${isMandatory ? 'bg-indigo-50/20' : ''}`}>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={isMandatory}
                            onChange={() => {
                              const key = `${selectedRoleId}-${module.id}`;
                              setRequirements(prev => ({
                                ...prev,
                                [key]: { is_mandatory: !isMandatory, frequency: prev[key]?.frequency || Frequency.ANNUAL }
                              }));
                            }}
                            className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-between items-start">
                             <div>
                               <p className="font-bold text-slate-800">{module.title}</p>
                               <p className="text-[10px] text-slate-400">Nota Mínima: {module.min_score_approval}% | Ref: {module.rdc_reference || 'Geral'}</p>
                             </div>
                             <button 
                               onClick={() => setPreviewModuleId(module.id)}
                               className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-100 transition-colors flex items-center gap-1"
                             >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                               Ver Conteúdo
                             </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-500">
                            {module.training_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            disabled={!isMandatory}
                            value={req?.frequency || Frequency.ONCE}
                            onChange={(e) => {
                              const key = `${selectedRoleId}-${module.id}`;
                              setRequirements(prev => ({ ...prev, [key]: { ...prev[key], frequency: e.target.value as Frequency } }));
                            }}
                            className="w-full text-xs border-slate-200 rounded-md py-1 disabled:opacity-30"
                          >
                            <option value={Frequency.ONCE}>Admissional (Único)</option>
                            <option value={Frequency.ANNUAL}>Reciclagem Anual</option>
                            <option value={Frequency.BIANNUAL}>Semestral</option>
                            <option value={Frequency.EVERY_3_YEARS}>A cada 3 anos</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic space-y-4">
              <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              <p>Selecione um cargo à esquerda para configurar sua matriz de competência.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Novo/Editar Cargo */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-up border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-6">{roleForm.id ? 'Editar Cargo' : 'Novo Cargo Profissional'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Cargo / Função</label>
                <input 
                  type="text" 
                  autoFocus
                  value={roleForm.name}
                  onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                  className="w-full border-slate-300 rounded-lg p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Biomédico de Bancada"
                />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                <input 
                  type="checkbox" 
                  checked={roleForm.is_critical}
                  onChange={e => setRoleForm({...roleForm, is_critical: e.target.checked})}
                  className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                />
                <div>
                  <span className="block text-sm font-bold text-slate-800">Função Crítica (RDC 978)</span>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Gatilho para monitoramento prioritário e alertas</span>
                </div>
              </label>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setIsRoleModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase hover:text-slate-800">Cancelar</button>
              <button 
                onClick={handleSaveRole}
                disabled={saving || !roleForm.name}
                className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold text-xs uppercase shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {saving ? 'Gravando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER MODAL OVERLAY */}
      {previewModuleId && (
        <TrainingModulePlayer 
          moduleId={previewModuleId} 
          onClose={() => setPreviewModuleId(null)} 
        />
      )}

    </div>
  );
};
