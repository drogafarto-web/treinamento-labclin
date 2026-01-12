
import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://xvwyhpsquacrfleiabny.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oOJuojLtPZMfwvAeGxUIMw_k5YyW1Ig';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Health Check Strategy
 */
export const checkConnection = async (): Promise<{ ok: boolean; message?: string }> => {
  try {
    if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
        return { ok: false, message: 'URL do Supabase não configurada corretamente.' };
    }
    
    const { error } = await supabase.from('units').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.code === '42P01') return { ok: true }; // Tabela não existe mas banco conectou

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
