import React, { useState, useEffect, useRef } from 'react';
import { supabase, checkConnection, setManualApiConfig } from './lib/supabaseClient';
import { Employee, UserRole } from './types';
import { Login } from './components/Login';
import { ChangePassword } from './components/ChangePassword';
import { SystemSetup } from './components/SystemSetup';
import { SystemDiagnosis } from './components/SystemDiagnosis';

import { Dashboard } from './components/Dashboard';
import { TrainingMatrix } from './components/TrainingMatrix';
import { EffectivenessAnalysis } from './components/EffectivenessAnalysis';
import { ContentGenerator } from './components/ContentGenerator';
import { Certificate } from './components/Certificate';
import { UserManagement } from './components/UserManagement';
import { MyTrainings } from './components/MyTrainings';
import { TrainingModuleAdmin } from './components/TrainingModuleAdmin';
import { getErrorMessage } from './lib/errorUtils';

enum Page {
  DASHBOARD = 'DASHBOARD',
  MY_TRAININGS = 'MY_TRAININGS',
  AI_TOOLS = 'AI_TOOLS',
  MATRIX = 'MATRIX',
  EFFECTIVENESS = 'EFFECTIVENESS',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  MODULES_ADMIN = 'MODULES_ADMIN'
}

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<{ok: boolean, message?: string}>({ ok: true });
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [slowLoading, setSlowLoading] = useState(false);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  
  // Estado para o input manual de chave API
  const [manualKey, setManualKey] = useState('');
  
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  
  const [certificateData, setCertificateData] = useState<any>(null);
  
  const loadingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    checkConnection().then(status => {
        if (!status.ok) setConnectionStatus(status);
    });

    if (window.location.hash === '#setup') {
        setIsSetupMode(true);
        setLoading(false);
        return;
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session && event === 'SIGNED_IN') {
        await fetchUserProfile(session.user.id);
      } else if (!session) {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  const initAuth = async () => {
      try {
        // TIMEOUT DE SEGURANÇA: Se o banco travar, libera o app em 5 segundos
        loadingTimeoutRef.current = window.setTimeout(() => {
          console.warn("⚠️ Timeout de segurança atingido. Forçando entrada.");
          setSlowLoading(true);
          setLoading(false); // Força a saída do estado de loading
        }, 5000);

        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          setSession(existingSession);
          await fetchUserProfile(existingSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Erro na inicialização:", e);
        setLoading(false);
      }
    };

  const fetchUserProfile = async (userId: string) => {
    // Não seta loading=true aqui para evitar piscar a tela se já estivermos no timeout
    setFatalError(null);

    try {
      // Tenta buscar com timeout curto na query se possível, mas o JS client n tem timeout nativo fácil
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, system_role, must_change_password, unit_id, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const msg = getErrorMessage(error);
        
        if (msg.includes('recursion') || msg.includes('policy')) {
          console.error("Erro Crítico de RLS:", msg);
          setFatalError("Erro Crítico de Permissão (Loop Infinito). Execute 'supabase_fix_final.sql' no Supabase.");
          // Não retorna, deixa o loading=false acontecer no finally ou timeout
        } else if (msg.includes('does not exist') || msg.includes('42P01')) {
           setFatalError("Banco de dados incompleto. Execute os scripts de correção SQL.");
        } else {
           // Erro genérico, loga mas permite acesso limitado
           console.warn("Falha ao carregar perfil:", msg);
        }
        setUserProfile(null);
      } else {
        setUserProfile(data || null);
        setSlowLoading(false);
      }
    } catch (e) {
      console.error('Exceção ao buscar perfil:', e);
    } finally {
      setLoading(false);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    }
  };

  const handleLogout = async () => {
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut().catch(() => {}); 
    window.location.href = window.location.origin + window.location.pathname;
  };

  // Função de Reset Total para casos de travamento
  const handleHardReset = () => {
    if(confirm("Isso limpará todos os dados locais do navegador e reiniciará o app. Útil se o sistema estiver travado. Continuar?")) {
      localStorage.clear();
      sessionStorage.clear();
      // Tenta limpar cookies específicos se possível ou apenas reload forçado
      window.location.reload();
    }
  };

  const handleSaveKey = () => {
    try {
      setManualApiConfig(manualKey.trim());
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getDisplayName = () => {
    let rawName = userProfile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Colaborador';
    return rawName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  if (showDiagnosis) {
    return <SystemDiagnosis onClose={() => setShowDiagnosis(false)} />;
  }

  // TELA DE ERRO DE CONEXÃO COM CAMPO DE CHAVE
  if (!connectionStatus.ok) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
          <h2 className="text-red-600 font-bold text-xl mb-2">Conexão Pendente</h2>
          <p className="text-slate-600 mb-6 text-sm">
             O sistema precisa da sua <strong>Chave Pública (Anon Key)</strong> do Supabase para conectar.
          </p>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cole sua chave 'anon' aqui:</label>
            <input 
              type="text" 
              value={manualKey}
              onChange={(e) => setManualKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
              className="w-full border border-slate-300 rounded p-2 text-xs font-mono mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={handleSaveKey}
              disabled={!manualKey}
              className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Salvar e Conectar
            </button>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Você encontra esta chave no Painel Supabase {'>'} Settings {'>'} API.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
             <p className="text-xs text-red-400 break-all mb-2">Erro Técnico: {connectionStatus.message}</p>
             <button onClick={() => window.location.reload()} className="text-sm text-slate-500 hover:text-slate-800 underline">Tentar Novamente (F5)</button>
             <div className="pt-2">
                <button onClick={() => setShowDiagnosis(true)} className="px-4 py-2 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50">
                   🛠️ Diagnóstico Completo
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // TELA DE ERRO FATAL (LOOP DE RLS)
  if (fatalError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full border border-red-500/50">
          <h2 className="text-red-400 font-bold text-2xl mb-4 flex items-center gap-2">
            <span>☠️</span> Erro Crítico no Banco de Dados
          </h2>
          <div className="bg-black/50 p-4 rounded text-red-200 text-sm mb-6 border-l-4 border-red-500">
            {fatalError}
          </div>
          <p className="text-slate-400 mb-6">
            Por favor, copie o conteúdo do arquivo <strong>supabase_fix_final.sql</strong> e execute-o no SQL Editor do Supabase.
          </p>
          <div className="flex gap-4">
             <button onClick={() => window.location.reload()} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-500 transition-colors">
               Já Executei, Tentar Novamente
             </button>
             <button onClick={handleHardReset} className="flex-1 bg-slate-700 text-white py-3 rounded-lg font-bold hover:bg-slate-600 transition-colors">
               Resetar Cache Local
             </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSetupMode) return <SystemSetup />;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center z-[9999] relative">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 animate-pulse">Sincronizando LabEdu</h2>
        </div>
        
        {/* Caixa de Ações de Demora */}
        <div className="mt-16 bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-xs text-center shadow-sm space-y-3">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Está demorando?</p>
           
           <button onClick={() => setShowDiagnosis(true)} style={{ cursor: 'pointer', pointerEvents: 'auto' }} className="w-full bg-indigo-100 text-indigo-700 py-3 px-4 rounded-xl text-xs font-bold hover:bg-indigo-200 transition-all shadow-sm">
             🔍 DIAGNOSTICAR PROBLEMA
           </button>

           <button onClick={handleHardReset} style={{ cursor: 'pointer', pointerEvents: 'auto' }} className="w-full bg-white border border-slate-200 text-red-600 py-3 px-4 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-all shadow-sm">
             🗑️ REINICIAR SISTEMA (LIMPAR CACHE)
           </button>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (userProfile?.must_change_password) {
    return <ChangePassword userId={session.user.id} onSuccess={() => fetchUserProfile(session.user.id)} />;
  }

  const handleOpenCertificate = (data: any) => {
    setCertificateData({
      employeeName: getDisplayName(),
      ...data
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex relative animate-fade-in">
      {slowLoading && !userProfile && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-xs font-bold text-center py-2 z-[10000] flex justify-center items-center gap-4 shadow-md">
          <span>⚠️ Conexão Lenta ou Instável: O sistema forçou a entrada. Algumas funções podem falhar.</span>
          <button onClick={handleHardReset} className="bg-white text-orange-600 px-3 py-1 rounded text-[10px] uppercase hover:bg-orange-50">
            Resetar Conexão
          </button>
        </div>
      )}

      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10 print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <span className="text-xl font-bold text-indigo-600">LabEdu</span>
          <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black">RDC 978</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setCurrentPage(Page.DASHBOARD)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${currentPage === Page.DASHBOARD ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
            🏠 Visão Geral (Gestor)
          </button>
          
          <button onClick={() => setCurrentPage(Page.MY_TRAININGS)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.MY_TRAININGS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            🎓 Meus Treinamentos
          </button>

          <div className="pt-6 pb-2"><p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão Corporativa</p></div>
          
          <button onClick={() => setCurrentPage(Page.MODULES_ADMIN)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.MODULES_ADMIN ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            📚 Módulos (Cursos)
          </button>

          <button onClick={() => setCurrentPage(Page.USER_MANAGEMENT)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.USER_MANAGEMENT ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            👥 Gestão de Usuários
          </button>

          <button onClick={() => setCurrentPage(Page.MATRIX)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.MATRIX ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            📊 Matriz de Treinamento
          </button>

          <button onClick={() => setCurrentPage(Page.EFFECTIVENESS)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.EFFECTIVENESS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            📉 Análise de Eficácia (IA)
          </button>

          <div className="pt-6 pb-2"><p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-slate-300">Ferramentas</p></div>
           <button onClick={() => setCurrentPage(Page.AI_TOOLS)} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === Page.AI_TOOLS ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            ✨ Gerador de Conteúdo
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {getDisplayName().substring(0,2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{getDisplayName()}</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tighter">
                {userProfile ? (userProfile.system_role || 'Colaborador') : 'Visitante'}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full text-xs text-slate-500 hover:text-red-600 text-left flex items-center gap-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 print:ml-0 min-h-screen">
        {currentPage === Page.DASHBOARD && <Dashboard />}
        {currentPage === Page.MATRIX && <TrainingMatrix />}
        {currentPage === Page.EFFECTIVENESS && <EffectivenessAnalysis />}
        {currentPage === Page.AI_TOOLS && <ContentGenerator />}
        {currentPage === Page.USER_MANAGEMENT && <UserManagement />}
        {currentPage === Page.MODULES_ADMIN && <TrainingModuleAdmin />}
        {currentPage === Page.MY_TRAININGS && (
          <MyTrainings 
            userId={session.user.id} 
            onViewCertificate={handleOpenCertificate} 
          />
        )}
      </main>

      {certificateData && (
        <Certificate 
          employeeName={certificateData.employeeName}
          moduleTitle={certificateData.moduleTitle}
          completionDate={certificateData.completionDate}
          score={certificateData.score}
          durationHours={certificateData.durationHours}
          onClose={() => setCertificateData(null)} 
        />
      )}
    </div>
  );
};

export default App;