import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../types';
import { getErrorMessage } from '../lib/errorUtils';

// Chaves de Administração (Mesmas usadas no Login para Recovery)
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2d3locHNxdWFjcmZsZWlhYm55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5MTUzNCwiZXhwIjoyMDgzNDY3NTM0fQ.Fao_Av3TW-Nqa4yNJEiKLSopN-76tEK6_jT8mQPDDHU';
const SUPABASE_URL = 'https://xvwyhpsquacrfleiabny.supabase.co';

// Lista de usuários para popular o banco de dados (Seed)
const USERS_TO_SEED = [
  { name: 'Renata Aparecida Dias Cintra', email: 'renata3@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Laila Teixeira Campos', email: 'camposlaila07@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Iara Rosa de Oliveira Reis', email: 'iararosareis@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Lara Veronica da Silva', email: 'laraveronica133@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Ernani Gomes Dutra', email: 'ernani_97@outlook.com', role: UserRole.COLLABORATOR },
  { name: 'Sabrina Hilario Florencio', email: 'sabrinaflorencioapp@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Nelia Paula Silva', email: 'neliapaulanela@gmail.com', role: UserRole.COLLABORATOR },
  { name: 'Deborah Aparecida de Oliveira', email: 'deborahap10@hotmail.com', role: UserRole.COLLABORATOR },
  // Admin / Gestor
  { name: 'Bruno de Andrade Pires', email: 'drogafarto@gmail.com', role: UserRole.ADMIN, is_admin: true },
];

export const SystemSetup: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const log = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runSetup = async () => {
    if (!confirm('Isso criará unidades, cargos e usuários no banco. Certifique-se de que "Email Confirmations" está DESATIVADO no Supabase Auth settings para agilizar. Continuar?')) return;
    
    setIsRunning(true);
    setLogs([]);
    
    try {
      log('--- INICIANDO SETUP ---');

      // Check basic connection first
      const { error: healthError } = await supabase.from('units').select('count', { count: 'exact', head: true });
      if (healthError && healthError.code === '42P01') {
          throw new Error("Tabelas não encontradas. Rode o script 'supabase_fix_rls.sql' no Supabase primeiro.");
      }

      // 1. Criar Unidade Padrão
      log('Criando/Buscando Unidade Matriz...');
      const { data: unit, error: unitError } = await supabase
        .from('units')
        .select('id')
        .eq('name', 'Laboratório Central (Matriz)')
        .maybeSingle();
      
      let unitId = unit?.id;

      if (!unitId) {
        const { data: newUnit, error: createUnitError } = await supabase
          .from('units')
          .insert({
            name: 'Laboratório Central (Matriz)',
            address: 'Rua Principal, 100',
            technical_manager: 'Dr. Responsável'
          })
          .select('id')
          .single();
        
        if (createUnitError) throw new Error(`Erro unidade: ${getErrorMessage(createUnitError)}`);
        unitId = newUnit.id;
        log('Unidade criada com sucesso.');
      } else {
        log('Unidade já existente.');
      }

      // 2. Criar Setor Padrão
      log('Criando/Buscando Setor Geral...');
      const { data: sector } = await supabase
        .from('sectors')
        .select('id')
        .eq('name', 'Geral')
        .maybeSingle();
      
      let sectorId = sector?.id;

      if (!sectorId) {
        const { data: newSector } = await supabase
          .from('sectors')
          .insert({ unit_id: unitId, name: 'Geral' })
          .select('id')
          .single();
        sectorId = newSector?.id;
      }

      // 3. Criar Cargos Básicos
      log('Verificando Cargos...');
      const rolesMap: Record<string, string> = {};
      const rolesToCreate = ['Admin Corporativo', 'Colaborador', 'Gestor da Qualidade'];

      for (const roleName of rolesToCreate) {
        let { data: role } = await supabase.from('roles').select('id').eq('name', roleName).maybeSingle();
        if (!role) {
          const { data: newRole } = await supabase.from('roles').insert({ name: roleName }).select('id').single();
          role = newRole;
        }
        if (role) rolesMap[roleName] = role.id;
      }

      // 4. Criar Usuários
      log('--- INICIANDO CRIAÇÃO DE USUÁRIOS ---');
      
      for (const user of USERS_TO_SEED) {
        log(`Processando: ${user.name}...`);

        // Tentar Login para ver se já existe
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: '123456'
        });

        let userId = signInData.user?.id;

        if (!userId) {
            // Criar Usuário no Auth
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: user.email,
                password: '123456',
                options: { data: { full_name: user.name } }
            });

            if (signUpError) {
                log(`ERRO Auth ${user.name}: ${getErrorMessage(signUpError)}`);
                continue;
            }
            userId = signUpData.user?.id;
            log(`Conta criada: ${user.email}`);
        }

        if (userId) {
            const roleDbId = user.is_admin ? rolesMap['Admin Corporativo'] : rolesMap['Colaborador'];
            const systemRole = user.is_admin ? UserRole.ADMIN : UserRole.COLLABORATOR;

            const { error: profileError } = await supabase
                .from('employees')
                .upsert({
                    id: userId,
                    full_name: user.name,
                    cpf: `000.${Math.floor(Math.random()*900)+100}.000-00`,
                    email: user.email, 
                    unit_id: unitId,
                    sector_id: sectorId,
                    role_id: roleDbId,
                    system_role: systemRole,
                    admission_date: new Date().toISOString(),
                    must_change_password: true,
                    is_active: true
                });

            if (profileError) {
                log(`ERRO Perfil ${user.name}: ${getErrorMessage(profileError)}`);
            } else {
                log(`Perfil OK: ${user.name}`);
            }
        }
      }

      log('--- FINALIZADO COM SUCESSO ---');
      await supabase.auth.signOut();

    } catch (e: any) {
      log(`ERRO CRÍTICO: ${getErrorMessage(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const promoteSpecificAdmin = async () => {
    setIsRunning(true);
    setLogs([]);
    log('--- PROMOVENDO ADMIN (SUPER MODE) ---');
    const email = 'drogafarto@gmail.com';
    
    try {
      // ⚠️ CRÍTICO: Usamos o cliente ADMIN para ignorar regras RLS (Row Level Security)
      // Isso garante que o admin seja criado mesmo que o banco esteja bloqueado.
      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      log('Conectado em modo ROOT/Superusuário.');

      // 1. Busca ou Cria Role de Admin
      let roleId;
      const { data: roleData } = await supabaseAdmin.from('roles').select('id').eq('name', 'Admin Corporativo').maybeSingle();
      
      if (roleData) {
        roleId = roleData.id;
      } else {
        log('Criando cargo Admin Corporativo...');
        const { data: newRole } = await supabaseAdmin.from('roles').insert({ name: 'Admin Corporativo', is_critical_function: true }).select('id').single();
        roleId = newRole?.id;
      }

      // 2. Garante Unidade e Setor (Cria se não existir)
      let unitId, sectorId;
      const { data: units } = await supabaseAdmin.from('units').select('id').limit(1);
      if (units && units.length > 0) {
        unitId = units[0].id;
      } else {
        log('Criando Unidade de Emergência...');
        const { data: u } = await supabaseAdmin.from('units').insert({ name: 'Matriz', address: 'Sede', technical_manager: 'Admin' }).select('id').single();
        unitId = u?.id;
      }

      const { data: sectors } = await supabaseAdmin.from('sectors').select('id').limit(1);
      if (sectors && sectors.length > 0) {
        sectorId = sectors[0].id;
      } else {
        const { data: s } = await supabaseAdmin.from('sectors').insert({ name: 'Geral', unit_id: unitId }).select('id').single();
        sectorId = s?.id;
      }

      // 3. Busca o ID do usuário no Auth (Admin API)
      log('Buscando usuário no Auth...');
      const { data: userData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const user = userData.users.find((u: any) => u.email === email);
      
      if (!user) {
         throw new Error('Usuário não encontrado no Auth. Faça Login/Cadastro na tela inicial primeiro.');
      }

      log(`Usuário encontrado: ${user.id}`);

      // 4. Upsert Poderoso (Ignora RLS)
      const { error: upsertError } = await supabaseAdmin
        .from('employees')
        .upsert({ 
          id: user.id,
          email: email,
          full_name: 'Bruno (Super Admin)',
          cpf: '000.000.000-00',
          unit_id: unitId,
          sector_id: sectorId,
          system_role: UserRole.ADMIN,
          role_id: roleId,
          is_active: true,
          must_change_password: false,
          admission_date: new Date().toISOString() // Data obrigatória incluída
        });

      if (upsertError) throw new Error(`Erro update: ${getErrorMessage(upsertError)}`);

      log('✅ SUCESSO ABSOLUTO: Usuário promovido a ADMIN (Bypass RLS).');
      alert('Usuário promovido com sucesso! Pode fazer login.');

    } catch (e) {
      log(`ERRO: ${getErrorMessage(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-green-400 mb-4">🛠️ Instalação do Sistema (Seed)</h1>
        <p className="mb-6 text-slate-400">
          Esta ferramenta popula o banco.
          <br/>
          <strong className="text-red-400">IMPORTANTE: O botão 'Forçar Admin' agora usa credenciais de ROOT para corrigir seu acesso, ignorando erros de permissão.</strong>
        </p>

        <div className="bg-black rounded-lg border border-slate-700 p-6 mb-6 h-96 overflow-y-auto font-xs">
          {logs.length === 0 ? (
            <span className="text-slate-600">Logs aparecerão aqui...</span>
          ) : (
            logs.map((l, i) => <div key={i} className="mb-1 border-b border-slate-800 pb-1 last:border-0">{l}</div>)
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={runSetup}
            disabled={isRunning}
            className={`flex-1 py-4 rounded font-bold text-lg ${
              isRunning 
                ? 'bg-slate-700 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-lg active:scale-95 transition-all'
            }`}
          >
            {isRunning ? 'EXECUTANDO...' : 'INICIAR INSTALAÇÃO AUTOMÁTICA'}
          </button>
          
          <button
            onClick={promoteSpecificAdmin}
            disabled={isRunning}
            className={`px-6 py-4 rounded font-bold text-sm ${
              isRunning 
                ? 'bg-slate-700 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg active:scale-95 transition-all'
            }`}
          >
            FORÇAR ADMIN (SUPER MODE)
          </button>
        </div>
      </div>
    </div>
  );
};