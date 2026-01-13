import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrainingModule, TrainingLesson, TrainingType, ModuleStatus, LessonContentType } from '../types';
import { TABLES } from '../constants/tables';
import { getErrorMessage } from '../lib/errorUtils';

export const TrainingModuleAdmin: React.FC = () => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [errorRLS, setErrorRLS] = useState(false);
  
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
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
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
    setErrorRLS(false);

    // Promise Race para forçar timeout se o banco travar (Loop RLS)
    const fetchPromise = supabase
      .from(TABLES.MODULES)
      .select('*')
      .order('title');

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_DB')), 5000)
    );

    try {
      // @ts-ignore
      const result: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.error) {
        throw result.error;
      }
      
      setModules(result.data || []);
    } catch (error: any) {
      console.error('Erro ao buscar módulos:', error);
      
      let isPermissionError = false;
      const msg = getErrorMessage(error);

      if (error.message === 'TIMEOUT_DB') {
        isPermissionError = true; // Timeout geralmente é loop de permissão
      } else if (msg.includes('Recursão') || msg.includes('recursion') || msg.includes('policy')) {
        isPermissionError = true;
      }

      if (isPermissionError) {
        setErrorRLS(true);
      } else {
        alert(`Erro de conexão: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (module: TrainingModule) => {
    setCurrentModule(module);
    setIsEditing(true);
    setLessons([]);
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
        const { error } = await supabase
            .from(TABLES.MODULES)
            .update(payload)
            .eq('id', currentModule.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
            .from(TABLES.MODULES)
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        savedModuleId = data.id;
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
    setErrorRLS(false);
    
    // Também adicionamos timeout aqui
    const fetchPromise = supabase
      .from(TABLES.LESSONS)
      .select('*')
      .eq('module_id', moduleId)
      .order('order_index');

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_DB')), 5000));

    try {
      // @ts-ignore
      const result: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (result.error) throw result.error;
      setLessons(result.data || []);
    } catch (error: any) {
      const msg = getErrorMessage(error);
      console.error("Erro ao buscar aulas:", msg);
      if (error.message === 'TIMEOUT_DB' || msg.includes('Recursão') || msg.includes('policy')) {
         setErrorRLS(true);
      } else {
         alert(`Erro ao carregar aulas: ${msg}`);
      }
    }
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
        content_url: newLesson.content_url || '',
        order_index: lessons.length + 1
      };

      const { error } = await supabase.from(TABLES.LESSONS).insert(lessonPayload);
      if (error) throw error;

      setNewLesson({ title: '', content_type: LessonContentType.VIDEO, content_url: '', order_index: 0 });
      await fetchLessons(currentModule.id);
    } catch (e) {
      alert(`Falha ao salvar aula: ${getErrorMessage(e)}`);
    } finally {
      setIsAddingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm("Tem certeza que deseja remover esta aula?")) return;
    
    setDeletingLessonId(lessonId);
    try {
      const { error } = await supabase
        .from(TABLES.LESSONS)
        .delete()
        .eq('id', lessonId);
      
      if (error) throw error;

      setLessons(prev => prev.filter(l => l.id !== lessonId));
    } catch (e) {
      alert(`Erro ao apagar aula: ${getErrorMessage(e)}`);
    } finally {
      setDeletingLessonId(null);
    }
  };

  // UI PARA ERRO DE RLS (TRAVAMENTO)
  if (errorRLS) {
    return (
      <div className="p-8 max-w-4xl mx-auto mt-10 animate-fade-in">
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-8 text-center shadow-2xl">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-black text-red-700 mb-4">ACESSO BLOQUEADO PELO BANCO</h2>
          <p className="text-red-900 text-lg mb-6">
            O sistema tentou carregar os dados, mas o banco de dados não respondeu (Timeout).<br/>
            Isso confirma que as regras de segurança (RLS) estão travadas.
          </p>
          
          <div className="bg-white p-6 rounded-lg border border-red-200 text-left mb-6 font-mono text-xs overflow-auto max-h-40">
            <p className="font-bold text-slate-800 mb-2">Copie e rode este SQL no Supabase para destravar:</p>
            <code className="text-blue-600 block">
              ALTER TABLE training_modules DISABLE ROW LEVEL SECURITY;<br/>
              ALTER TABLE training_lessons DISABLE ROW LEVEL SECURITY;<br/>
              ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
            </code>
          </div>
          
          <div className="flex gap-4 justify-center">
            <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700">
              Tentar Novamente (F5)
            </button>
            <a 
              href="https://supabase.com/dashboard/project/_/sql" 
              target="_blank" 
              rel="noreferrer"
              className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-black"
            >
              Abrir Supabase SQL Editor ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="text-center py-20">
             <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
             <p className="text-slate-500 font-medium">Carregando cursos...</p>
             <p className="text-xs text-slate-400 mt-2">Se demorar mais de 5s, um erro será mostrado.</p>
          </div>
        ) : modules.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
            <p className="text-xl font-bold text-slate-400 mb-2">Nenhum curso encontrado</p>
            <p className="text-slate-500 text-sm mb-6">O banco de dados retornou vazio.</p>
            <button onClick={handleNewClick} className="text-indigo-600 font-bold hover:underline">
              Criar o primeiro curso agora
            </button>
          </div>
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
                  
                  <div className="flex gap-2 border-t border-slate-100 pt-4">
                    <button onClick={() => handleEditClick(mod)} className="flex-1 py-2 text-indigo-600 font-bold text-sm bg-indigo-50 rounded hover:bg-indigo-100">Editar</button>
                    <button onClick={() => handleDeleteModule(mod.id)} className="px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // TELA DE EDIÇÃO
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
        
        {/* ESQUERDA: Form do Módulo */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="font-bold text-slate-700 border-b pb-2 mb-4">Informações Básicas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Curso</label>
                <input type="text" value={currentModule.title} onChange={e => setCurrentModule({...currentModule, title: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Ex: Biossegurança Básica" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição Curta</label>
                <input type="text" value={currentModule.short_description || ''} onChange={e => setCurrentModule({...currentModule, short_description: e.target.value})} className="w-full border-slate-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                <select value={currentModule.training_type} onChange={e => setCurrentModule({...currentModule, training_type: e.target.value as TrainingType})} className="w-full border-slate-300 rounded p-2 text-sm">
                  {Object.values(TrainingType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                <select value={currentModule.status || ModuleStatus.DRAFT} onChange={e => setCurrentModule({...currentModule, status: e.target.value as ModuleStatus})} className="w-full border-slate-300 rounded p-2 text-sm font-bold text-indigo-900">
                  <option value={ModuleStatus.DRAFT}>Rascunho</option>
                  <option value={ModuleStatus.PUBLISHED}>Publicado</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA: Lista de Aulas */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-700 border-b pb-2 mb-4">Grade Curricular</h2>
            
            {!currentModule.id ? (
              <div className="text-center py-8 bg-orange-50 rounded border border-orange-200 p-4">
                 <p className="text-orange-800 font-bold text-sm mb-2">Salve primeiro</p>
                 <button onClick={handleSaveModule} className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold">Salvar Módulo</button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto min-h-[100px]">
                  {lessons.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                      <p className="text-xs text-slate-400">Nenhuma aula cadastrada.</p>
                    </div>
                  ) : (
                    lessons.map((lesson, idx) => (
                      <div key={lesson.id} className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between items-center group">
                         <div className="flex items-center gap-3 overflow-hidden">
                           <span className="w-6 h-6 bg-white border rounded-full flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{idx + 1}</span>
                           <div className="min-w-0">
                             <p className="font-bold text-slate-800 text-sm truncate">{lesson.title}</p>
                             <p className="text-[10px] text-slate-500 uppercase">{lesson.content_type}</p>
                           </div>
                         </div>
                         
                         <button 
                           onClick={() => handleDeleteLesson(lesson.id)} 
                           disabled={deletingLessonId === lesson.id}
                           className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                           title="Excluir Aula"
                         >
                           {deletingLessonId === lesson.id ? (
                             <div className="animate-spin h-5 w-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                           ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                             </svg>
                           )}
                         </button>

                      </div>
                    ))
                  )}
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <h3 className="text-xs font-bold text-indigo-800 uppercase mb-3">Adicionar Aula</h3>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Título da Aula"
                      className="w-full text-xs border-indigo-200 rounded p-2 outline-none"
                      value={newLesson.title}
                      onChange={e => setNewLesson({...newLesson, title: e.target.value})}
                    />
                    <select 
                      className="w-full text-xs border-indigo-200 rounded p-2 outline-none"
                      value={newLesson.content_type}
                      onChange={e => setNewLesson({...newLesson, content_type: e.target.value as LessonContentType})}
                    >
                      <option value={LessonContentType.VIDEO}>Vídeo</option>
                      <option value={LessonContentType.PDF}>PDF</option>
                      <option value={LessonContentType.TEXT}>Texto</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="URL ou Conteúdo"
                      className="w-full text-xs border-indigo-200 rounded p-2 outline-none"
                      value={newLesson.content_url || ''}
                      onChange={e => setNewLesson({...newLesson, content_url: e.target.value})}
                    />
                    <button 
                      onClick={handleAddLesson} 
                      disabled={isAddingLesson || !newLesson.title}
                      className="w-full bg-indigo-600 text-white text-xs font-bold py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isAddingLesson ? 'Salvando...' : '+ Adicionar'}
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