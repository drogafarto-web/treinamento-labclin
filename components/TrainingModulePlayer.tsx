import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrainingModule, TrainingLesson, LessonContentType } from '../types';
import { TABLES } from '../constants/tables';
import { getErrorMessage } from '../lib/errorUtils';

interface TrainingModulePlayerProps {
  moduleId: string;
  onClose: () => void;
}

export const TrainingModulePlayer: React.FC<TrainingModulePlayerProps> = ({ moduleId, onClose }) => {
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<TrainingLesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      
      try {
        // 1. Load Module
        const { data: modData, error: modError } = await supabase
            .from(TABLES.MODULES)
            .select('*')
            .eq('id', moduleId)
            .single();
        
        if (modError) throw modError;
        setModule(modData);

        // 2. Load Lessons
        const { data: lessonData, error: lessonError } = await supabase
          .from(TABLES.LESSONS)
          .select('*')
          .eq('module_id', moduleId)
          .order('order_index');
        
        if (lessonError) throw lessonError;
        
        setLessons(lessonData || []);
        
        if (lessonData && lessonData.length > 0) {
          setActiveLesson(lessonData[0]);
        }
      } catch (error: any) {
        const msg = getErrorMessage(error);
        console.error("Erro no Player:", msg);
        
        if (msg.includes('recursion') || msg.includes('policy')) {
            alert("⚠️ ERRO CRÍTICO (Recursão Infinita detectada)\n\nO banco de dados entrou em loop ao verificar permissões.\n\nSOLUÇÃO: Execute o script 'supabase_fix_lessons_rls.sql' no Supabase SQL Editor para corrigir as políticas RLS.");
        } else {
            alert(`Erro ao carregar conteúdo: ${msg}`);
        }
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [moduleId, onClose]);

  // Helper para renderizar conteúdo
  const renderContent = (lesson: TrainingLesson) => {
    switch (lesson.content_type) {
      case LessonContentType.VIDEO:
        // Tenta extrair ID do Youtube se for um link padrão
        let embedUrl = lesson.content_url;
        if (lesson.content_url?.includes('youtube.com/watch?v=')) {
          const videoId = lesson.content_url.split('v=')[1]?.split('&')[0];
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (lesson.content_url?.includes('youtu.be/')) {
           const videoId = lesson.content_url.split('youtu.be/')[1];
           embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }

        return (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden shadow-lg">
            <iframe 
              src={embedUrl} 
              className="w-full h-full" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              title={lesson.title}
            ></iframe>
          </div>
        );
      
      case LessonContentType.PDF:
        return (
          <div className="h-[600px] w-full bg-slate-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-300">
            <div className="text-center p-8">
              <span className="text-4xl block mb-4">📄</span>
              <h3 className="font-bold text-slate-800 text-lg">{lesson.title}</h3>
              <p className="text-slate-500 mb-6 max-w-md">Este conteúdo é um documento PDF. Clique abaixo para abrir em uma nova aba.</p>
              <a 
                href={lesson.content_url} 
                target="_blank" 
                rel="noreferrer"
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 inline-flex items-center gap-2"
              >
                Abrir Documento PDF
              </a>
            </div>
          </div>
        );

      case LessonContentType.LINK:
        return (
          <div className="p-10 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
            <h3 className="text-xl font-bold text-indigo-900 mb-4">Conteúdo Externo</h3>
            <p className="text-indigo-700 mb-6">Para acessar esta aula, visite o link abaixo:</p>
            <a href={lesson.content_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold break-all">
              {lesson.content_url}
            </a>
          </div>
        );

      default: // TEXT
        return (
           <div className="prose max-w-none p-6 bg-white rounded-lg border border-slate-200">
             <h3 className="text-lg font-bold mb-4">{lesson.title}</h3>
             <p className="whitespace-pre-wrap text-slate-600">{lesson.content_url}</p>
           </div>
        );
    }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  if (!module) return null;

  return (
    <div className="fixed inset-0 bg-slate-50 z-[5000] flex flex-col animate-fade-in overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" title="Sair do Curso">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">{module.title}</h1>
            <p className="text-xs text-slate-500">Módulo de Treinamento RDC 978</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden hidden md:block">
             <div className="h-full bg-green-500 w-1/3"></div> {/* TODO: Connect to real progress */}
           </div>
           <span className="text-xs font-bold text-slate-500 hidden md:block">33% Concluído</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar (Playlist) */}
        <aside className="w-80 bg-white border-r border-slate-200 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Conteúdo do Curso</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {lessons.map((lesson, idx) => {
              const isActive = activeLesson?.id === lesson.id;
              return (
                <div 
                  key={lesson.id} 
                  onClick={() => setActiveLesson(lesson)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${isActive ? 'bg-indigo-50 border-r-4 border-indigo-600' : ''}`}
                >
                  <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-400'}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{lesson.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      {lesson.content_type === LessonContentType.VIDEO ? '🎥 Vídeo' : '📄 Leitura'}
                    </p>
                  </div>
                </div>
              );
            })}
            {lessons.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Nenhum conteúdo disponível.</p>}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8 flex justify-center">
          <div className="w-full max-w-4xl space-y-6">
            {activeLesson ? (
              <>
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {renderContent(activeLesson)}
                 </div>
                 
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                   <h2 className="text-2xl font-bold text-slate-800 mb-2">{activeLesson.title}</h2>
                   <p className="text-slate-600 text-sm leading-relaxed">{module.description}</p>
                   
                   <div className="mt-6 flex justify-between items-center pt-6 border-t border-slate-100">
                     <button className="text-slate-500 text-sm font-bold hover:text-indigo-600">← Aula Anterior</button>
                     <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                       Próxima Aula →
                     </button>
                   </div>
                 </div>
              </>
            ) : (
              <div className="text-center py-20">
                <h2 className="text-xl font-bold text-slate-400">Selecione uma aula para começar</h2>
              </div>
            )}
            
            {/* Module Meta */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 mt-8">
              <h3 className="font-bold text-slate-800 text-sm uppercase mb-4">Sobre este Módulo</h3>
              <p className="text-sm text-slate-600 mb-4">{module.description}</p>
              
              {module.objectives && (
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-bold text-indigo-900 text-xs uppercase mb-2">Objetivos de Aprendizagem</h4>
                  <pre className="whitespace-pre-wrap text-sm text-indigo-800 font-sans">{module.objectives}</pre>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};