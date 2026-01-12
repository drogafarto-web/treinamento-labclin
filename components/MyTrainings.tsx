
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface MyTrainingsProps {
  userId: string;
  onViewCertificate: (data: { moduleTitle: string, completionDate: string, score: number, durationHours: number }) => void;
}

export const MyTrainings: React.FC<MyTrainingsProps> = ({ userId, onViewCertificate }) => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      // Busca matrículas conectando com agendamento e módulo
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          progress_pct,
          final_score,
          completed_at,
          schedule:training_schedule (
            end_date,
            module:training_modules (
              title,
              description,
              duration_minutes,
              training_type
            )
          )
        `)
        .eq('employee_id', userId);

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Erro ao buscar treinamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [userId]);

  // Função auxiliar para gerar dados na hora, caso o banco esteja vazio (Demo Mode)
  const generateDemoData = async () => {
    if (!confirm("Isso irá gerar um treinamento concluído de exemplo para você. Continuar?")) return;
    try {
      setLoading(true);
      // 1. Pega ou cria um módulo
      let moduleId;
      const { data: modules } = await supabase.from('training_modules').select('id').limit(1);
      
      if (!modules || modules.length === 0) {
        const { data: newMod } = await supabase.from('training_modules').insert({
            title: 'Biossegurança Laboratorial Avançada',
            description: 'Normas de segurança NR-32 e RDC 978 para manipulação de amostras biológicas.',
            training_type: 'BIOSSEGURANCA',
            duration_minutes: 240,
            min_score_approval: 70
        }).select().single();
        moduleId = newMod?.id;
      } else {
        moduleId = modules[0].id;
      }

      // 2. Cria agendamento
      const { data: schedule } = await supabase.from('training_schedule').insert({
        module_id: moduleId,
        instructor_id: userId,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        status: 'FINISHED'
      }).select().single();

      if (!schedule) throw new Error("Falha ao criar agendamento");

      // 3. Cria matrícula concluída
      await supabase.from('enrollments').insert({
        schedule_id: schedule.id,
        employee_id: userId,
        status: 'COMPLETED',
        progress_pct: 100,
        final_score: 95,
        completed_at: new Date().toISOString()
      });
      
      await fetchEnrollments();
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar dados de demo.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-indigo-600 font-bold">Carregando seus cursos...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meus Treinamentos</h1>
          <p className="text-slate-500">Acompanhe seu desenvolvimento profissional e certificações</p>
        </div>
        {enrollments.length === 0 && (
          <button 
            onClick={generateDemoData} 
            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
          >
            + Gerar Dados de Demonstração
          </button>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-sm">
            🎓
          </div>
          <h3 className="text-lg font-bold text-slate-800">Tudo em dia!</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">
            Você não possui treinamentos pendentes no momento. Verifique a matriz de competências com seu gestor da qualidade.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enrollment) => {
            const module = enrollment.schedule?.module;
            const isCompleted = enrollment.status === 'COMPLETED';
            
            return (
              <div key={enrollment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-all hover:-translate-y-1">
                <div className={`h-1.5 w-full ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`}></div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                      isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {enrollment.status === 'COMPLETED' ? 'CONCLUÍDO' : 'EM ANDAMENTO'}
                    </span>
                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      {module?.duration_minutes || 60} min
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mb-2 leading-tight">
                    {module?.title || 'Treinamento sem título'}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-6 flex-1 leading-relaxed">
                    {module?.description || 'Descrição não disponível.'}
                  </p>

                  <div className="mt-auto space-y-5">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                        <span>Progresso</span>
                        <span>{enrollment.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-green-500' : 'bg-indigo-600'}`} 
                          style={{ width: `${enrollment.progress_pct}%` }}
                        ></div>
                      </div>
                    </div>

                    {isCompleted ? (
                      <button 
                        onClick={() => onViewCertificate({
                          moduleTitle: module?.title || 'Treinamento',
                          completionDate: new Date(enrollment.completed_at).toLocaleDateString('pt-BR'),
                          score: enrollment.final_score,
                          durationHours: Number(((module?.duration_minutes || 60) / 60).toFixed(1))
                        })}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-indigo-50 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 hover:border-indigo-100 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Ver Certificado
                      </button>
                    ) : (
                      <button className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                        Continuar Estudo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
