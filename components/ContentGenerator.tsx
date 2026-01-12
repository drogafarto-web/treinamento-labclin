
import React, { useState } from 'react';
import { generateQuizQuestions, generateLessonOutline } from '../services/aiServiceDesign';
import { getErrorMessage } from '../lib/errorUtils';

export const ContentGenerator: React.FC = () => {
  const [tab, setTab] = useState<'QUIZ' | 'LESSON'>('QUIZ');
  const [popText, setPopText] = useState('');
  const [topic, setTopic] = useState('');
  const [rdcRef, setRdcRef] = useState('Art. 126, RDC 978/2025');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerateQuiz = async () => {
    if (!popText) return alert("Cole o texto do POP primeiro.");
    setLoading(true);
    try {
      const data = await generateQuizQuestions({ popText: '', numQuestions: 4, difficulty: 'MEDIUM' }, popText);
      setResult(data);
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!popText || !topic) return alert("Preencha o tema e o texto do POP.");
    setLoading(true);
    try {
      const data = await generateLessonOutline(topic, popText, rdcRef);
      setResult(data);
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Gerador de Conteúdo IA</h1>
        <p className="text-slate-500">Transforme POPs técnicos em materiais de treinamento (RDC 978).</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => { setTab('QUIZ'); setResult(null); }}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${tab === 'QUIZ' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
          >
            📝 Gerador de Quiz
          </button>
          <button 
            onClick={() => { setTab('LESSON'); setResult(null); }}
            className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${tab === 'LESSON' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
          >
            🎓 Plano de Aula
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {tab === 'LESSON' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tema do Treinamento</label>
                  <input 
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ex: Coleta Venosa em Idosos"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referência Normativa (RDC)</label>
                <input 
                  type="text"
                  value={rdcRef}
                  onChange={e => setRdcRef(e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Texto Base (POP / Instrução)</label>
                <textarea 
                  rows={10}
                  value={popText}
                  onChange={e => setPopText(e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                  placeholder="Cole aqui o conteúdo técnico do Procedimento Operacional Padrão..."
                />
              </div>

              <button 
                onClick={tab === 'QUIZ' ? handleGenerateQuiz : handleGenerateLesson}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processando com Gemini...
                  </>
                ) : (
                  <>✨ Gerar Conteúdo Inteligente</>
                )}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[500px]">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                  <span className="text-4xl mb-4">🚀</span>
                  <p>Insira os dados à esquerda e clique em gerar.</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="animate-pulse bg-slate-200 h-4 w-48 rounded"></div>
                  <div className="animate-pulse bg-slate-200 h-4 w-64 rounded"></div>
                  <div className="animate-pulse bg-slate-200 h-32 w-full rounded"></div>
                </div>
              )}

              {result && tab === 'QUIZ' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    ✅ Quiz Gerado com Sucesso
                  </h3>
                  {result.map((q: any, i: number) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <p className="font-semibold text-slate-800 text-sm mb-3">{i+1}. {q.question}</p>
                      <ul className="space-y-2">
                        {q.options.map((opt: string, idx: number) => (
                          <li key={idx} className={`text-xs p-2 rounded border ${idx === q.correctAnswerIndex ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                            {opt} {idx === q.correctAnswerIndex && '✓'}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 p-2 bg-indigo-50 rounded text-[10px] text-indigo-700">
                        <strong>Explicação:</strong> {q.explanation}
                      </div>
                    </div>
                  ))}
                  <button className="w-full border-2 border-indigo-600 text-indigo-600 py-2 rounded-lg font-medium hover:bg-indigo-50">
                    Salvar no Banco de Questões
                  </button>
                </div>
              )}

              {result && tab === 'LESSON' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-indigo-900 text-white p-6 rounded-lg shadow-inner">
                    <h3 className="text-xl font-serif font-bold">{result.title}</h3>
                    <p className="text-indigo-200 text-xs mt-1">Duração Estimada: {result.duration_minutes} minutos</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">🎯 Objetivos de Aprendizado</h4>
                    <ul className="space-y-1">
                      {result.objectives.map((obj: string, i: number) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-indigo-500">•</span> {obj}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">💡 Pontos-Chave</h4>
                    <div className="space-y-3">
                      {result.key_points.map((pt: any, i: number) => (
                        <div key={i} className="bg-white p-3 rounded border-l-4 border-indigo-600 shadow-sm">
                          <p className="font-bold text-slate-800 text-sm">{pt.topic}</p>
                          <p className="text-xs text-slate-500 mt-1">{pt.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
