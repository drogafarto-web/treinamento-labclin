
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage } from '../lib/errorUtils';

// Service Role Key for emergency resets (Dev/Admin usage only)
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2d3locHNxdWFjcmZsZWlhYm55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5MTUzNCwiZXhwIjoyMDgzNDY3NTM0fQ.Fao_Av3TW-Nqa4yNJEiKLSopN-76tEK6_jT8mQPDDHU';
const SUPABASE_URL = 'https://xvwyhpsquacrfleiabny.supabase.co';

export const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Sign Up
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        // --- REGISTRATION FLOW ---
        if (!fullName.trim()) {
          throw new Error("Por favor, informe seu nome completo para o certificado.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName, // Saves name in user_metadata
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          setSuccessMsg("Cadastro realizado com sucesso! Você já pode entrar.");
          setIsSignUp(false); // Switch back to login view
        }
      } else {
        // --- LOGIN FLOW ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const msg = getErrorMessage(error);
          if (msg.includes('Email not confirmed')) {
             throw new Error('E-mail não confirmado.');
          } else if (msg.includes('Invalid login')) {
             throw new Error('E-mail ou senha incorretos.');
          } else {
             throw error;
          }
        }
        // Success redirects automatically via App.tsx listener
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyReset = async () => {
    if (!confirm('Isso resetará a senha do usuário "drogafarto@gmail.com" para "123456". Continuar?')) return;
    
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;

      const targetEmail = 'drogafarto@gmail.com';
      const user = data?.users.find((u: any) => u.email === targetEmail);

      if (!user) throw new Error(`Usuário ${targetEmail} não encontrado.`);

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        user.id,
        {
          password: '123456',
          email_confirm: true,
          user_metadata: { email_verified: true }
        }
      );

      if (updateError) throw updateError;
      
      setSuccessMsg('Sucesso! Senha redefinida para "123456".');
      setEmail(targetEmail);
      setPassword('123456');

    } catch (err: any) {
      setError(`Erro no reset: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            L
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LabEdu - RDC 978</h1>
          <p className="text-slate-500 mt-2">
            {isSignUp ? 'Crie sua conta profissional' : 'Sistema de Educação Continuada'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-100">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isSignUp && (
            <div className="animate-fade-in-down">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo (Para o Certificado)</label>
              <input
                type="text"
                required={isSignUp}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Dra. Maria Silva"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="seu.nome@laboratorio.com.br"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Processando...' : (isSignUp ? 'Cadastrar' : 'Acessar Sistema')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMsg(null);
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
          >
            {isSignUp 
              ? 'Já possui uma conta? Faça Login' 
              : 'Não tem acesso? Cadastre-se'}
          </button>
        </div>
        
        {!isSignUp && (
          <div className="mt-6 border-t border-slate-100 pt-4">
             <button 
               onClick={handleEmergencyReset}
               type="button"
               className="w-full text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors flex items-center justify-center gap-1"
             >
               🛠️ Resetar Senha Admin (Dev Fix)
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
