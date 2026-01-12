
import React, { useState } from 'react';
import { summarizeTrainingEffectiveness } from '../services/aiServiceDesign';
import { AIEffectivenessRequest } from '../types';
import { getErrorMessage } from '../lib/errorUtils';

export const EffectivenessAnalysis: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string, trends: string[], suggestions: string[] } | null>(null);
  
  const [formData, setFormData] = useState<AIEffectivenessRequest>({
    feedback: '',
    errorRateBefore: 0,
    errorRateAfter: 0,
    nonConformities: 0
  });

  const handleAnalyze = async () => {
    if (!formData.feedback) return alert("Por favor, insira o feedback qualitativo.");
    
    setIsLoading(true);
    try {
      const parsed = await summarizeTrainingEffectiveness(formData, "Módulo Selecionado");
      setResult(parsed);
    } catch (error) {
      console.error("AI Error", error);
      alert(`Erro na análise de IA: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
       <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Análise de Eficácia com IA</h1>
        <p className="text-slate-500">Avalie o impacto dos treinamentos usando indicadores de qualidade e feedback (Art. 126, RDC 978).</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Dados do Ciclo de Treinamento</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Módulo Analisado</label>
              <select className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                <option>Coleta Venosa Pediátrica</option>
                <option>Biossegurança Geral</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Taxa de Erro (Antes)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={formData.errorRateBefore}
                    onChange={(e) => setFormData({...formData, errorRateBefore: Number(e.target.value)})}
                    className="w-full border-slate-300 rounded-md pl-3 pr-8 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Taxa de Erro (Depois)</label>
                <div className="relative">
                  <input 
                    type="number"
                     value={formData.errorRateAfter}
                    onChange={(e) => setFormData({...formData, errorRateAfter: Number(e.target.value)})}
                    className="w-full border-slate-300 rounded-md pl-3 pr-8 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400">%</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Não Conformidades (Qtd)</label>
              <input 
                type="number"
                value={formData.nonConformities}
                onChange={(e) => setFormData({...formData, nonConformities: Number(e.target.value)})}
                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Feedback Qualitativo (Observação Prática)</label>
              <textarea 
                rows={4}
                value={formData.feedback}
                onChange={(e) => setFormData({...formData, feedback: e.target.value})}
                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: O colaborador demonstra segurança na técnica, mas esqueceu da etapa de identificação..."
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 shadow-md"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando com Gemini...
                  </>
                ) : (
                  <>✨ Gerar Relatório de Eficácia</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 relative min-h-[400px]">
          {!result && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <p>Os resultados da análise de inteligência aparecerão aqui.</p>
            </div>
          )}
          
          {result && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-indigo-900 font-bold flex items-center gap-2">
                  <span className="text-xl">📊</span> Resumo Executivo
                </h3>
                <p className="mt-2 text-slate-700 leading-relaxed bg-white p-4 rounded border border-slate-200 shadow-sm text-sm">
                  {result.summary}
                </p>
              </div>

              <div>
                <h3 className="text-indigo-900 font-bold flex items-center gap-2 text-sm">
                  <span className="text-xl">📈</span> Tendências Identificadas
                </h3>
                <ul className="mt-2 space-y-2">
                  {result.trends.map((trend, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-700 text-xs">
                      <span className="text-green-500 mt-1">•</span>
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-indigo-900 font-bold flex items-center gap-2 text-sm">
                  <span className="text-xl">💡</span> Sugestões de Melhoria
                </h3>
                <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded p-4">
                  <ul className="space-y-2">
                    {result.suggestions.map((sug, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-800 text-xs">
                        <span className="text-yellow-600 font-bold">→</span>
                        {sug}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
