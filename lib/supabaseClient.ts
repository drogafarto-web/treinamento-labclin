import { createClient } from '@supabase/supabase-js';

// Tenta pegar do .env (Desenvolvimento)
const env = (import.meta as any).env || {};
const envUrl = env.VITE_SUPABASE_URL;
const envKey = env.VITE_SUPABASE_ANON_KEY;

// Tenta pegar do LocalStorage (Emergência / Correção Manual via UI)
const storedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('labedu_supabase_url') : null;
const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('labedu_supabase_key') : null;

// Configuração Final
const supabaseUrl = envUrl || storedUrl || 'https://xvwyhpsquacrfleiabny.supabase.co';

// Chave ANON fornecida (Hardcoded para garantir funcionamento imediato)
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2d3locHNxdWFjcmZsZWlhYm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTE1MzQsImV4cCI6MjA4MzQ2NzUzNH0.4NcaF7pc6MDmpHlymQaQXNHiR2hyEashNeMwCyvhgnY';

const supabaseAnonKey = envKey || storedKey || fallbackKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Salva a chave manualmente e recarrega a página.
 * Usado pela tela de erro para corrigir a conexão sem editar código.
 */
export const setManualApiConfig = (key: string) => {
  if (!key.startsWith('eyJ')) {
    throw new Error("A chave parece inválida. Ela deve começar com 'eyJ'.");
  }
  localStorage.setItem('labedu_supabase_key', key);
  window.location.reload();
};

/**
 * Health Check Strategy
 */
export const checkConnection = async (): Promise<{ ok: boolean; message?: string }> => {
  try {
    if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
        return { ok: false, message: 'URL do Supabase não configurada.' };
    }

    if (!supabaseAnonKey) {
       return { ok: false, message: 'Chave de API não configurada.' };
    }
    
    // Tenta uma query leve.
    const { error } = await supabase.from('units').select('count', { count: 'exact', head: true });
    
    if (error) {
      // 42P01: Tabela não existe (Banco conectado, mas vazio) -> OK
      if (error.code === '42P01') return { ok: true }; 
      
      // 42501 / Recursion: Erro de permissão (Banco conectado, mas bloqueado) -> OK (Corrigir com SQL)
      if (error.code === '42501' || error.message.toLowerCase().includes('recursion')) {
          return { ok: true };
      }

      // Outros erros (ex: chave inválida, rede, etc)
      return { 
        ok: false, 
        message: error.message || `Erro de conexão (Código ${error.code})` 
      };
    }
    return { ok: true };
  } catch (e: any) {
    return { 
      ok: false, 
      message: e.message || 'Falha catastrófica ao tentar conexão com o servidor.' 
    };
  }
};