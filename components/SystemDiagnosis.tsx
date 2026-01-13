import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TABLES } from '../constants/tables';

interface DiagnosticStep {
  id: string;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR';
  message?: string;
}

export const SystemDiagnosis: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [steps, setSteps] = useState<DiagnosticStep[]>([
    { id: 'conn', label: 'Conexão com Supabase', status: 'PENDING' },
    { id: 'auth', label: 'Sessão de Usuário', status: 'PENDING' },
    { id: 'table_units', label: 'Tabela: Units (Unidades)', status: 'PENDING' },
    { id: 'table_employees', label: 'Tabela: Employees (Colaboradores)', status: 'PENDING' },
    { id: 'rls_check', label: 'Verificação de Permissões (RLS)', status: 'PENDING' },
  ]);

  const updateStep = (id: string, status: 'RUNNING' | 'SUCCESS' | 'ERROR', message?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, message } : s));
  };

  const runDiagnostics = async () => {
    // 1. Teste de Conexão Básica
    updateStep('conn', 'RUNNING');
    try {
      const start = performance.now();
      const { error } = await supabase.from(TABLES.UNITS).select('count', { count: 'exact', head: true });
      
      // Erro 42P01 significa que conectou, mas a tabela não existe. Isso é "Sucesso" na conexão, mas falha na tabela.
      if (error && error.code !== '42P01') throw error;
      
      const ping = Math.round(performance.now() - start);
      updateStep('conn', 'SUCCESS', `Conectado (${ping}ms)`);
    } catch (e: any) {
      updateStep('conn', 'ERROR', e.message || 'Falha ao alcançar servidor');
      return; // Aborta se não conecta
    }

    // 2. Teste de Auth
    updateStep('auth', 'RUNNING');
    let userId = '';
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        userId = data.session.user.id;
        updateStep('auth', 'SUCCESS', `Logado como: ${data.session.user.email}`);
      } else {
        updateStep('auth', 'ERROR', 'Nenhum usuário logado. Faça login primeiro.');
        // Não aborta, pois podemos testar tabelas públicas se houver
      }
    } catch (e: any) {
      updateStep('auth', 'ERROR', e.message);
    }

    // 3. Teste Tabela Units
    updateStep('table_units', 'RUNNING');
    try {
      const { error } = await supabase.from(TABLES.UNITS).select('id').limit(1);
      if (error) {
        if (error.code === '42P01') throw new Error("Tabela não existe no banco.");
        throw error;
      }
      updateStep('table_units', 'SUCCESS', 'Tabela acessível');
    } catch (e: any) {
      updateStep('table_units', 'ERROR', e.message);
    }

    // 4. Teste Tabela Employees (Crítica para Loop)
    updateStep('table_employees', 'RUNNING');
    try {
      const { error } = await supabase.from(TABLES.EMPLOYEES).select('id').limit(1);
      if (error) {
        if (error.code === '42P01') throw new Error("Tabela não existe.");
        if (error.code === '42501') throw new Error("Permissão negada (RLS).");
        throw error;
      }
      updateStep('table_employees', 'SUCCESS', 'Tabela acessível');
    } catch (e: any) {
      updateStep('table_employees', 'ERROR', e.message);
    }

    // 5. Teste Específico de RLS (Recursão)
    updateStep('rls_check', 'RUNNING');
    try {
      if (!userId) {
        updateStep('rls_check', 'ERROR', 'Pular: Usuário não logado');
      } else {
        // Tenta ler o PRÓPRIO perfil. É aqui que o loop costuma acontecer.
        const { error } = await supabase.from(TABLES.EMPLOYEES).select('id').eq('id', userId).single();
        
        if (error) {
           // Detecção de mensagem de recursão
           const msg = error.message.toLowerCase();
           if (msg.includes('recursion') || msg.includes('infinite') || msg.includes('policy')) {
             throw new Error("LOOP INFINITO DETECTADO! As políticas de segurança estão em conflito.");
           }
           throw error;
        }
        updateStep('rls_check', 'SUCCESS', 'Políticas RLS parecem saudáveis.');
      }
    } catch (e: any) {
      updateStep('rls_check', 'ERROR', e.message);
    }
  };

  React.useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-slate-700">
          <h2 className="text-white font-bold flex items-center gap-2">
            <span className="animate-pulse text-green-400">●</span> Diagnóstico de Sistema
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        
        <div className="p-6 space-y-4">
          {steps.map(step => (
            <div key={step.id} className="flex items-start gap-4 p-3 rounded bg-slate-800/50 border border-slate-700/50">
              <div className="mt-1">
                {step.status === 'PENDING' && <div className="w-4 h-4 rounded-full border-2 border-slate-600"></div>}
                {step.status === 'RUNNING' && <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>}
                {step.status === 'SUCCESS' && <div className="text-green-500">✓</div>}
                {step.status === 'ERROR' && <div className="text-red-500 font-bold">✕</div>}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${step.status === 'PENDING' ? 'text-slate-500' : 'text-slate-200'}`}>
                  {step.label}
                </p>
                {step.message && (
                  <p className={`text-xs mt-1 ${step.status === 'ERROR' ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800">
          <p className="text-slate-500 text-xs mb-3">
            Se houver erros de "Loop Infinito" ou "Recursão", execute o script de correção no SQL Editor.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={runDiagnostics} className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded hover:bg-slate-700">
              Rodar Novamente
            </button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">
              Recarregar App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};