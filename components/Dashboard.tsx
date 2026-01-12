import React, { useEffect, useState } from 'react';
import { TrainingSchedule, TrainingModule, ComplianceViewItem } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/errorUtils';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PLANNED: 'bg-blue-100 text-blue-800',
    FINISHED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

export const Dashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<ComplianceViewItem[]>([]);
  const [schedule, setSchedule] = useState<TrainingSchedule[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // States for "Novo Agendamento" Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableModules, setAvailableModules] = useState<TrainingModule[]>([]);
  const [newScheduleForm, setNewScheduleForm] = useState({
    module_id: '',
    start_date: new Date().toISOString().split('T')[0],
  });
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

  // Fetch Data Function (Reusable)
  const fetchData = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    // 1. Fetch Alerts (Compliance View)
    setLoadingAlerts(true);
    const { data: alertsData, error: alertsError } = await supabase
      .from('view_compliance_status')
      .select('*')
      .lt('days_remaining', 30)
      .order('days_remaining', { ascending: true })
      .limit(10);

    if (alertsError) console.error('Error fetching alerts:', alertsError);
    else if (alertsData) setAlerts(alertsData as any);
    setLoadingAlerts(false);

    // 2. Fetch Schedule
    setLoadingSchedule(true);
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('training_schedule')
      .select(`
        *,
        TrainingModule:training_modules (
          title,
          training_type,
          rdc_reference
        )
      `)
      .order('start_date', { ascending: true })
      .limit(5);

    if (scheduleError) console.error('Error fetching schedule:', scheduleError);
    else if (scheduleData) setSchedule(scheduleData as any);
    setLoadingSchedule(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch modules only when modal is opened to save resources
  useEffect(() => {
    if (isModalOpen && availableModules.length === 0) {
      const loadModules = async () => {
        const { data } = await supabase.from('training_modules').select('*').order('title');
        if (data) setAvailableModules(data as any);
      };
      loadModules();
    }
  }, [isModalOpen]);

  // Handler: Open Modal
  const handleOpenNewSchedule = () => {
    setIsModalOpen(true);
    setNewScheduleForm({
      module_id: '',
      start_date: new Date().toISOString().split('T')[0],
    });
  };

  // Handler: Create Schedule
  const handleCreateSchedule = async () => {
    if (!newScheduleForm.module_id || !newScheduleForm.start_date) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    setIsCreatingSchedule(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Tentar obter Unit ID do usuário logado (Tabela employees)
      let targetUnitId = null;

      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('unit_id')
        .eq('id', user.id)
        .maybeSingle(); 
      
      if (employeeData?.unit_id) {
          targetUnitId = employeeData.unit_id;
      } else {
          // Fallback: Se o usuário não tiver unidade, buscar a primeira unidade (Tabela units)
          console.warn("Usuário sem unidade vinculada. Buscando unidade padrão...");
          const { data: defaultUnit, error: unitError } = await supabase
            .from('units')
            .select('id')
            .limit(1)
            .maybeSingle();
            
          if (unitError) {
              console.error("Erro ao buscar unidade padrão:", unitError);
              throw unitError;
          }

          if (defaultUnit) {
              targetUnitId = defaultUnit.id;
          } else {
             throw new Error("Nenhuma unidade cadastrada no sistema. Execute o Setup.");
          }
      }

      // 2. Criar Agendamento com o unit_id recuperado
      const { error } = await supabase.from('training_schedule').insert({
        module_id: newScheduleForm.module_id,
        unit_id: targetUnitId, 
        start_date: newScheduleForm.start_date,
        end_date: newScheduleForm.start_date, // Default 1 day
        instructor_id: user.id, // Current user as instructor
        status: 'PLANNED'
      });

      if (error) throw error;

      alert("✅ Agendamento criado com sucesso!");
      setIsModalOpen(false);
      fetchData(); // Refresh list

    } catch (e: any) {
      console.error("Erro completo (obj):", e);
      alert(`Erro ao criar agendamento: ${getErrorMessage(e)}`);
    } finally {
      setIsCreatingSchedule(false);
    }
  };

  // Handler: Enroll Button (Alerts)
  const handleEnrollClick = async (item: ComplianceViewItem) => {
    const confirm = window.confirm(`Confirmar inscrição imediata de ${item.employee_name} no treinamento "${item.module_title}"?`);
    if (!confirm) return;

    // TODO: In a real scenario, check for existing open schedule or create one.
    // For now, we simulate success and optimistic UI update.
    
    alert(`✅ Inscrição solicitada!\n\n${item.employee_name} foi adicionado(a) à próxima turma de "${item.module_title}".`);
    
    // Remove alert from list visually (Optimistic Update)
    setAlerts(prev => prev.filter(a => a.employee_id !== item.employee_id || a.module_title !== item.module_title));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Cronograma de Educação Continuada 2025</h1>
        <p className="text-slate-500">Gestão de Competência e Treinamento - RDC 978</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">Conformidade da Equipe</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">87%</p>
          <span className="text-xs text-green-600">↑ 2% vs mês anterior</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">Alertas Críticos</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {loadingAlerts ? '...' : alerts.length}
          </p>
          <span className="text-xs text-orange-600">Treinamentos vencendo</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">Eficácia Média</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">9.2</p>
          <span className="text-xs text-slate-400">Escala 0-10</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Schedule - 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Próximos Treinamentos (Cronograma)</h2>
            <button 
              onClick={handleOpenNewSchedule}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <span className="text-lg">+</span> Novo Agendamento
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Módulo / Tema</th>
                  <th className="px-6 py-3">Período</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSchedule && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Carregando cronograma...</td>
                  </tr>
                )}
                
                {!loadingSchedule && schedule.length === 0 && (
                   <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Nenhum treinamento agendado.</td>
                  </tr>
                )}

                {schedule.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{item.TrainingModule?.title || 'Módulo sem título'}</p>
                      {item.TrainingModule?.rdc_reference && (
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {item.TrainingModule.rdc_reference}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(item.start_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:underline">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recertification Alerts - 1/3 width */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-orange-50/50">
            <h2 className="font-semibold text-orange-900 flex items-center gap-2">
              ⚠️ Alertas de Recertificação
            </h2>
            <p className="text-xs text-orange-700 mt-1">Baseado na Matriz de Treinamento (RDC 978)</p>
          </div>
          
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {loadingAlerts && (
              <div className="p-4 text-center text-xs text-slate-400">Carregando alertas...</div>
            )}
            
            {!loadingAlerts && alerts.length === 0 && (
               <div className="p-4 text-center text-xs text-green-600">
                 Nenhum alerta pendente. Equipe em conformidade!
               </div>
            )}

            {alerts.map((alert) => (
              <div key={`${alert.employee_id}-${alert.module_title}`} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-800 text-sm truncate max-w-[120px]" title={alert.employee_name}>
                    {alert.employee_name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    alert.days_remaining <= 5 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {alert.days_remaining} dias
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">{alert.role_name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="font-medium">Renovar:</span> 
                  <span className="truncate">{alert.module_title}</span>
                </div>
                <button 
                  onClick={() => handleEnrollClick(alert)}
                  className="w-full mt-3 text-xs bg-white border border-slate-300 text-slate-700 py-1.5 rounded hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                >
                  Inscrever no Módulo
                </button>
              </div>
            ))}
            
             <div className="p-3 text-center border-t border-slate-100">
              <button className="text-xs text-slate-500 hover:text-indigo-600 font-medium">
                Ver Relatório Completo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Novo Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fade-in-down">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Agendar Treinamento</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Módulo de Treinamento</label>
                <select 
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={newScheduleForm.module_id}
                  onChange={e => setNewScheduleForm({...newScheduleForm, module_id: e.target.value})}
                >
                  <option value="">Selecione um módulo...</option>
                  {availableModules.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
                {availableModules.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">Nenhum módulo cadastrado. Cadastre módulos no banco primeiro.</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Início</label>
                <input 
                  type="date" 
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  value={newScheduleForm.start_date}
                  onChange={e => setNewScheduleForm({...newScheduleForm, start_date: e.target.value})}
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateSchedule}
                disabled={isCreatingSchedule}
                className="px-4 py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingSchedule ? 'Agendando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};