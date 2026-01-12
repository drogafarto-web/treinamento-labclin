
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/errorUtils';

interface ChangePasswordProps {
  userId: string;
  onSuccess: () => void;
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ userId, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Por favor, preencha ambos os campos de senha.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Atualiza a senha no Supabase Auth (Obrigatório)
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) {
        if (authError.message.includes("different from the old")) {
          throw new Error("A nova senha deve ser diferente da anterior.");
        }
        throw authError;
      }

      // 2. Tenta atualizar a flag no Banco de Dados (Opcional/Resiliente)
      // Se isso falhar por erro de RLS/Recursão, não queremos travar o usuário
      try {
        const { error: dbError } = await supabase
          .from('employees')
          .update({ must_change_password: false })
          .eq('id', userId);
        
        if (dbError) {
          console.warn("Aviso: Senha alterada no Auth, mas falha ao atualizar perfil no DB:", dbError.message);
          // Se for erro de recursão, ignoramos e seguimos, pois a senha JÁ MUDOU no Auth.
          if (!dbError.message.includes('recursion')) {
            // Se for outro erro, logamos mas não travamos
          }
        }
      } catch (dbException) {
        console.error("Exceção ao atualizar DB:", dbException);
      }

      // 3. Sucesso!
      // Mesmo que o passo 2 falhe, a senha no Auth mudou.
      // Chamamos onSuccess para o App.tsx tentar recarregar o perfil.
      onSuccess();

    } catch (err: any) {
      console.error("Change Password Error:", err);
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-orange-200 animate-scale-up">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">🔐</div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Definir Nova Senha</h1>
          <p className="text-slate-600 mt-2 text-sm leading-relaxed">
            Por segurança, sua senha temporária expirou. Escolha uma nova senha forte para continuar.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 flex items-start gap-2">
             <span className="font-bold">⚠️</span>
             <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1" htmlFor="new-password">Nova Senha</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50 text-sm"
              placeholder="Mínimo 6 caracteres"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1" htmlFor="confirm-password">Confirmar Nova Senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50 text-sm"
              placeholder="Repita a nova senha"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-md active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processando...</span>
              </>
            ) : 'Salvar e Acessar Painel'}
          </button>
          
          <p className="text-[10px] text-center text-slate-400 mt-4">
            Em conformidade com as diretrizes de segurança RDC 978/2025.
          </p>
        </form>
      </div>
    </div>
  );
};
