
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabaseClient';
import { Employee, UserRole, Unit, Sector, JobRole } from '../types';
import { TABLES } from '../constants/tables';
import { getErrorMessage } from '../lib/errorUtils';

// --- SUB-COMPONENTE: EditEmployeeModal ---
interface EditEmployeeModalProps {
  employee?: any | null;
  units: Unit[];
  roles: JobRole[];
  sectors: Sector[];
  onClose: () => void;
  onSuccess: () => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ 
  employee, units, roles, sectors, onClose, onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: employee ? {
      full_name: employee.full_name,
      cpf: employee.cpf,
      email: employee.email || '',
      system_role: employee.system_role,
      unit_id: employee.unit_id,
      sector_id: employee.sector_id,
      role_id: employee.role_id,
      admission_date: employee.admission_date ? employee.admission_date.split('T')[0] : new Date().toISOString().split('T')[0],
      is_active: employee.is_active ?? true
    } : {
      system_role: UserRole.COLLABORATOR,
      is_active: true,
      admission_date: new Date().toISOString().split('T')[0]
    }
  });

  const selectedUnitId = watch('unit_id');
  const filteredSectors = sectors.filter(s => s.unit_id === selectedUnitId);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (employee) {
        // Atualiza, incluindo o updated_at via trigger do banco (ou explícito se desejado)
        const { error } = await supabase
          .from(TABLES.EMPLOYEES)
          .update(data)
          .eq('id', employee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(TABLES.EMPLOYEES)
          .insert([{ ...data, id: crypto.randomUUID(), must_change_password: true }]);
        if (error) throw error;
      }
      onSuccess();
    } catch (e) {
      alert(`Falha na operação: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-scale-up border border-slate-200 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">{employee ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
            <input 
              {...register('full_name', { required: "Nome é obrigatório" })}
              className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 ${errors.full_name ? 'border-red-500' : 'border-slate-300'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF</label>
            <input 
              {...register('cpf', { required: "CPF é obrigatório" })}
              placeholder="000.000.000-00"
              className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 ${errors.cpf ? 'border-red-500' : 'border-slate-300'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
            <input 
              {...register('email', { pattern: /^\S+@\S+$/i })}
              className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 ${errors.email ? 'border-red-500' : 'border-slate-300'}`}
              placeholder="exemplo@laboratorio.com.br"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Perfil de Acesso</label>
            <select {...register('system_role')} className="w-full border-slate-300 rounded-lg p-2 text-sm border">
              <option value={UserRole.COLLABORATOR}>Colaborador</option>
              <option value={UserRole.UNIT_MANAGER}>Gestor de Unidade</option>
              <option value={UserRole.INSTRUCTOR}>Instrutor</option>
              <option value={UserRole.ADMIN}>Administrador Global</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cargo / Função</label>
            <select {...register('role_id', { required: true })} className="w-full border-slate-300 rounded-lg p-2 text-sm border">
              <option value="">Selecione...</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name} {r.is_critical_function ? '(Crítico)' : ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
            <select {...register('unit_id', { required: true })} className="w-full border-slate-300 rounded-lg p-2 text-sm border">
              <option value="">Selecione...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor</label>
            <select {...register('sector_id', { required: true })} className="w-full border-slate-300 rounded-lg p-2 text-sm border">
              <option value="">Selecione a Unidade primeiro...</option>
              {filteredSectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Admissão</label>
            <input type="date" {...register('admission_date', { required: true })} className="w-full border-slate-300 rounded-lg p-2 text-sm border" />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" {...register('is_active')} className="w-4 h-4 text-indigo-600 rounded" />
            <span className="text-sm font-medium text-slate-700">Colaborador Ativo</span>
          </div>

          <div className="md:col-span-2 mt-6 flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancelar</button>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-bold text-xs uppercase shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Processando...' : 'Confirmar Dados'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL: UserManagement ---
export const UserManagement: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Busca Tabelas de Apoio primeiro
      const { data: uData } = await supabase.from('units').select('*');
      const { data: rData } = await supabase.from('roles').select('*');
      const { data: sData } = await supabase.from('sectors').select('*');
      
      setUnits(uData || []);
      setRoles(rData || []);
      setSectors(sData || []);

      // 2. Busca Employees com Junção (Join)
      // Se houver recursão no RLS, este bloco costuma falhar
      const { data: eData, error: eErr } = await supabase
        .from('employees')
        .select(`
          *,
          roles:role_id ( name, is_critical_function ),
          units:unit_id ( name )
        `)
        .order('full_name');
      
      if (eErr) {
        // Se falhar por recursão, tenta a 'Busca Simples' para não travar a tela
        if (eErr.message.includes('recursion')) {
          console.warn('Recursão detectada no Join. Tentando busca simples...');
          const { data: simpleData, error: simpleErr } = await supabase
            .from('employees')
            .select('*')
            .order('full_name');
          
          if (simpleErr) throw simpleErr;
          
          // Mapeia manualmente para manter a interface funcionando
          const mappedData = (simpleData || []).map(emp => ({
            ...emp,
            roles: rData?.find(r => r.id === emp.role_id),
            units: uData?.find(u => u.id === emp.unit_id)
          }));
          setEmployees(mappedData);
          return;
        }
        throw eErr;
      }

      setEmployees(eData || []);
    } catch (e: any) {
      console.error('Erro na carga de dados:', e);
      setErrorMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleClearCacheAndLogout = async () => {
    if (confirm("Isso irá limpar sua sessão e cache local para resolver erros de permissão. Continuar?")) {
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const filteredEmployees = employees.filter(e => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (e.full_name || '').toLowerCase().includes(term);
    const cpfMatch = (e.cpf || '').includes(term);
    const emailMatch = e.email ? e.email.toLowerCase().includes(term) : false;
    return nameMatch || cpfMatch || emailMatch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestão de Usuários</h1>
          <p className="text-slate-500 text-sm">Controle de colaboradores, perfis de acesso e conformidade RDC 978</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg shadow-sm transition-all"
            title="Recarregar dados"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Novo Colaborador
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-5 rounded-xl flex items-start gap-4 shadow-sm animate-fade-in ring-1 ring-red-300">
          <div className="bg-red-100 p-2.5 rounded-full text-red-600 mt-0.5 shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="flex-1">
            <p className="font-black text-red-900 text-lg">Bloqueio de Segurança Detectado</p>
            <p className="text-sm text-red-700 leading-relaxed mt-1 font-medium">{errorMsg}</p>
            <div className="mt-4 flex flex-wrap gap-2">
               <button onClick={fetchData} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-black uppercase hover:bg-red-700 shadow transition-all active:scale-95">Tentar de Novo</button>
               <button onClick={() => window.location.reload()} className="px-4 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-black uppercase hover:bg-red-50 transition-all">F5 (Recarregar)</button>
               <button onClick={handleClearCacheAndLogout} className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-black uppercase hover:bg-black transition-all">Limpar Cache e Sair</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Buscar por nome, CPF ou E-mail..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-full border-slate-300 rounded-lg p-2 text-sm focus:ring-indigo-500 border"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[10px] tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Cargo / Função</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4 text-center">Perfil</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center animate-pulse text-slate-400 italic">Sincronizando com o banco...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">Nenhum registro encontrado ou acesso bloqueado via RLS.</td></tr>
              ) : filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{emp.full_name || 'Sem Nome'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{emp.cpf || 'Sem CPF'}</p>
                    {emp.email && <p className="text-[10px] text-indigo-500 truncate max-w-[150px]">{emp.email}</p>}
                    
                    {/* INDICADOR VISUAL DE INTEGRIDADE DO BANCO */}
                    {emp.updated_at && (
                      <p className="text-[9px] text-green-600 mt-1 flex items-center gap-1 bg-green-50 px-1 rounded w-fit border border-green-100" title="A coluna updated_at existe e está populada!">
                         ✓ Sync: {new Date(emp.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700">{emp.roles?.name || emp.role_id || 'Não definido'}</span>
                    {emp.roles?.is_critical_function && (
                      <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1 rounded font-black uppercase">Crítico</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {emp.units?.name || emp.unit_id || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                      emp.system_role === UserRole.ADMIN ? 'bg-red-50 text-red-700' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {emp.system_role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`w-2 h-2 inline-block rounded-full ${emp.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`}></span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { setEditingEmployee(emp); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Editar Colaborador"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <EditEmployeeModal 
          employee={editingEmployee}
          units={units}
          roles={roles}
          sectors={sectors}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
};
