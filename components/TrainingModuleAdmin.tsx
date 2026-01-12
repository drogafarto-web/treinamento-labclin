import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrainingModule, TrainingLesson, TrainingType, ModuleStatus, LessonContentType } from '../types';
import { TABLES } from '../constants/tables';
import { getErrorMessage } from '../lib/errorUtils';

export const TrainingModuleAdmin: React.FC = () => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estado do Módulo em Edição
  const [currentModule, setCurrentModule] = useState<Partial<TrainingModule>>({
    title: '',
    description: '',
    short_description: '',
    objectives: '',
    training_type: TrainingType.TECNICO,
    duration_minutes: 60,
    workload_hours: 1,
    min_score_approval: 70,
    requires_quiz: false,
    status: ModuleStatus.DRAFT,
    rdc_reference: ''
  });

  // Estado das Aulas do Módulo
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLesson, setNewLesson] = useState<Partial<TrainingLesson>>({
    title: '',
    content_type: LessonContentType.VIDEO,
    content_url: '',
    order_index: 0
  });

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLES.MODULES)
      .select('*')
      .order('title');
    
    if (error) {
      console.error('Erro ao buscar módulos:', getErrorMessage(error));
      alert(`Erro ao carregar lista de módulos: ${getErrorMessage(error)}`);
    }
    setModules(data || []);
    setLoading(false);
  };

  const handleEditClick = async (module: TrainingModule) => {
    setCurrentModule(module);
    setIsEditing(true);
    await fetchLessons(module.id);
  };

  const handleNewClick = () => {
    setCurrentModule({
      title: '',
      description: '',
      short_description: '',
      objectives: '',
      training_type: TrainingType.TECNICO,
      duration_minutes: 60,
      workload_hours: 1,
      min_score_approval: 70,
      requires_quiz: false,
      status: ModuleStatus.DRAFT,
      rdc_reference: ''
    });
    setLessons([]);
    setIsEditing(true);
  };

  const handleSaveModule = async () => {
    try {
      if (!currentModule.title) throw new Error("Título é obrigatório");

      const payload = {
        title: currentModule.title,
        description: currentModule.description || null,
        short_description: currentModule.short_description || null,
        objectives: currentModule.objectives || null,
        training_type: currentModule.training_type || TrainingType.TECNICO,
        duration_minutes: currentModule.duration_minutes || 60,
        workload_hours: currentModule.workload_hours || 1,
        min_score_approval: currentModule.min_score_approval || 70,
        requires_quiz: currentModule.requires_quiz || false,
        status: currentModule.status || ModuleStatus.DRAFT,
        rdc_reference: currentModule.rdc_reference || null,
        updated_at: new Date().toISOString()
      };

      let savedModuleId = currentModule.id;

      if (currentModule.id) {
        // UPDATE
        const { error } = await supabase
            .from(TABLES.MODULES)
            .update(payload)
            .eq('id', currentModule.id);
        
        if (error) throw error;
      } else {
        // INSERT
        const { data, error } = await supabase
            .from(TABLES.MODULES)
            .insert(payload)
            .select()
            .single();
            
        if (error) throw error;
        savedModuleId = data.id;
        // Atualiza o estado local com o ID gerado para permitir adicionar aulas imediatamente
        setCurrentModule({ ...currentModule, id: savedModuleId }); 
      }

      alert('✅ Módulo salvo com sucesso! Agora você pode adicionar aulas.');
      if (!isEditing) fetchModules(); 
    } catch (e) {
      console.error(e);
      alert(`Erro ao salvar: ${getErrorMessage(e)}`);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("ATENÇÃO: Apagar este módulo excluirá TODAS as aulas vinculadas e históricos. Continuar?")) return;
    try {
      const { error } = await supabase.from(TABLES.MODULES).delete().eq('id', id);
      if (error) throw error;
      fetchModules();
    } catch (e) {
      alert(`Erro ao apagar: ${getErrorMessage(e)}`);
    }
  };

  // --- LESSONS LOGIC ---

  const fetchLessons = async (moduleId: string) => {
    const { data, error } = await supabase
      .from(TABLES.LESSONS)
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index');
    
    if (error) {
       const msg = getErrorMessage(error);
       console.error("Erro ao buscar aulas:", msg);
       
       if (error.code === '42P01') {
         alert("Tabela 'training_lessons' não existe. Por favor, execute o script SQL de correção no Supabase.");
       } else if (msg.includes('recursion') || msg.includes('policy')) {
         alert("⚠️ ERRO CRÍTICO: Recursão Infinita (RLS) detectada.\n\nExecute o script 'supabase_fix_lessons_rls.sql' no Supabase SQL Editor para corrigir as políticas de segurança.");
       } else {
         alert(`Erro ao carregar aulas: ${msg}`);
       }
       return;
    }
    setLessons(data || []);
  };

  const handleAddLesson = async () => {
    if (!currentModule.id) return alert("Salve o módulo (botão verde acima) antes de adicionar aulas.");
    if (!newLesson.title) return alert("Título da aula obrigatório.");

    setIsAddingLesson(true);
    try {
      const lessonPayload = {
        module_id: currentModule.id,
        title: newLesson.title,
        content_type: newLesson.content_type,
        content_url: newLesson.content_url || '', // Garante string vazia se undefined
        order_index: lessons.length + 1
      };

      // Tenta inserir na tabela training_lessons
      const { error } = await supabase.from(TABLES.LESSONS).insert(lessonPayload);
      
      if (error) {
        if (error.code === '42P01') {
            throw new Error("Tabela de aulas não encontrada. Execute 'supabase_fix_final.sql' no Supabase.");
        }
        throw error;
      }

      await fetchLessons(currentModule.id);
      setNewLesson({ title: '', content_type: LessonContentType.VIDEO, content_url: '', order_index: 0 });
      alert("Aula adicionada com sucesso à grade!");
    } catch (e) {
      alert(`Erro ao adicionar aula: ${getErrorMessage(e)}`);
    } finally {
      setIsAddingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("Remover esta aula?")) return;
    try {
      const { error } = await supabase.from(TABLES.LESSONS).delete().eq('id', lessonId);
      if (error) throw error;
      if (currentModule.id) await fetchLessons(currentModule.id);
    } catch (e) {
      alert(`Erro: ${getErrorMessage(e)}`);
    }
  };

  if (!isEditing) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestão de Módulos (Cursos)</h1>
            <p className="text-slate-500">Crie e gerencie o conteúdo didático da plataforma.</p>
          </div>
          <button onClick={handleNewClick} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-all">
            + Novo Módulo
          </button>
        </header>

        {loading ? (
          <div className="text-center py-10 text-slate-400">Carregando cursos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map(mod => (
              <div key={mod.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                <div className={`h-2 w-full ${mod.status === ModuleStatus.PUBLISHED ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded border border-slate-100">{mod.training_type}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${mod.status === ModuleStatus.PUBLISHED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {mod.status === ModuleStatus.PUBLISHED ? 'PUBLICADO' : 'RASCUNHO'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{mod.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">{mod.short_description || mod.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
                    <span className="flex items-center gap-1">🕒 {mod.workload_hours || 1}h</span>
                    <span className="flex items-center gap-1">🏆 Min: {mod.min_score_approval}%</span>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 pt-4">
                    <button onClick={() => handleEditClick(mod)} className="flex-1 py-2 text-indigo-600 font-bold text-sm bg-indigo-50 rounded hover:bg-indigo-100">Editar</button>
                    <button onClick={() => handleDeleteModule(mod.id)} className="px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- EDITOR VIEW ---
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 font-bold">← Voltar</button>
        <h1 className="text-xl font-bold text-slate-800">{currentModule.id ? 'Editar Curso' : 'Novo Curso'}</h1>
        <div className="ml-auto">
          <button onClick={handleSaveModule} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm transition-all">
            Salvar Módulo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA DA ESQUERDA: Detalhes do Módulo */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-bold text-slate-700 border-b pb-2 mb-4">Informações Básicas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Curso</label>
                <input type="text" value={currentModule.title} onChange={e => setCurrentModule({...currentModule, title: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Ex: Biossegurança Básica" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Curta (Card)</label>
                <input type="text" value={currentModule.short_description || ''} onChange={e => setCurrentModule({...currentModule, short_description: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Resumo em uma frase..." />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Completa</label>
                <textarea rows={3} value={currentModule.description} onChange={e => setCurrentModule({...currentModule, description: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Detalhes sobre o curso..." />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Objetivos de Aprendizagem</label>
                <textarea rows={3} value={currentModule.objectives || ''} onChange={e => setCurrentModule({...currentModule, objectives: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="- Aprender X&#10;- Entender Y" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Treinamento</label>
                <select value={currentModule.training_type} onChange={e => setCurrentModule({...currentModule, training_type: e.target.value as TrainingType})} className="w-full border-slate-300 rounded p-2 text-sm">
                  {Object.values(TrainingType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

               <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select value={currentModule.status || ModuleStatus.DRAFT} onChange={e => setCurrentModule({...currentModule, status: e.target.value as ModuleStatus})} className="w-full border-slate-300 rounded p-2 text-sm font-bold text-indigo-900">
                  <option value={ModuleStatus.DRAFT}>Rascunho (Oculto)</option>
                  <option value={ModuleStatus.PUBLISHED}>Publicado (Visível)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Carga Horária (Horas)</label>
                <input type="number" step="0.5" value={currentModule.workload_hours || 1} onChange={e => setCurrentModule({...currentModule, workload_hours: Number(e.target.value)})} className="w-full border-slate-300 rounded p-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nota Mínima (%)</label>
                <input type="number" value={currentModule.min_score_approval} onChange={e => setCurrentModule({...currentModule, min_score_approval: Number(e.target.value)})} className="w-full border-slate-300 rounded p-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ref. RDC 978</label>
                <input type="text" value={currentModule.rdc_reference || ''} onChange={e => setCurrentModule({...currentModule, rdc_reference: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" />
              </div>

              <div className="flex items-center gap-2 pt-4">
                 <input type="checkbox" checked={currentModule.requires_quiz || false} onChange={e => setCurrentModule({...currentModule, requires_quiz: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                 <span className="text-sm font-bold text-slate-700">Exige Prova Final?</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DA DIREITA: Aulas */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-700 border-b pb-2 mb-4">Grade Curricular</h2>
            
            {!currentModule.id ? (
              <div className="text-center py-8 bg-orange-50 rounded border border-orange-200 p-4">
                 <p className="text-orange-800 font-bold text-sm mb-2">Módulo não salvo</p>
                 <p className="text-xs text-orange-600 mb-4">Você precisa salvar os dados básicos antes de adicionar aulas.</p>
                 <button onClick={handleSaveModule} className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold shadow hover:bg-green-700">Salvar Módulo Agora</button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {lessons.map((lesson, idx) => (
                    <div key={lesson.id} className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center group">
                       <div className="flex items-center gap-3 overflow-hidden">
                         <span className="w-6 h-6 bg-white border rounded-full flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</span>
                         <div className="min-w-0">
                           <p className="font-bold text-slate-800 text-sm truncate">{lesson.title}</p>
                           <p className="text-[10px] text-slate-500 uppercase">{lesson.content_type}</p>
                         </div>
                       </div>
                       <button onClick={() => handleDeleteLesson(lesson.id)} className="text-slate-300 hover:text-red-500 p-1">✕</button>
                    </div>
                  ))}
                  {lessons.length === 0 && <p className="text-xs text-slate-400 text-center italic">Nenhuma aula cadastrada.</p>}
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 relative">
                  {isAddingLesson && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center"><div className="animate-spin h-5 w-5 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>}
                  
                  <h3 className="text-xs font-bold text-indigo-800 uppercase mb-3">Adicionar Aula</h3>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Título da Aula"
                      className="w-full text-xs border-indigo-200 rounded p-2"
                      value={newLesson.title}
                      onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                    />
                    <select 
                      className="w-full text-xs border-indigo-200 rounded p-2"
                      value={newLesson.content_type}
                      onChange={e => setNewLesson({...newLesson, content_type: e.target.value as LessonContentType})}
                    >
                      <option value={LessonContentType.VIDEO}>Vídeo (Youtube/Vimeo)</option>
                      <option value={LessonContentType.PDF}>Documento PDF</option>
                      <option value={LessonContentType.LINK}>Link Externo</option>
                      <option value={LessonContentType.TEXT}>Texto Simples</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder={newLesson.content_type === LessonContentType.VIDEO ? "URL do Vídeo" : "URL / Conteúdo"}
                      className="w-full text-xs border-indigo-200 rounded p-2"
                      value={newLesson.content_url || ''}
                      onChange={e => setNewLesson({...newLesson, content_url: e.target.value})}
                    />
                    <button 
                      onClick={handleAddLesson} 
                      disabled={isAddingLesson}
                      className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isAddingLesson ? 'Salvando...' : '+ Adicionar à Grade'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};