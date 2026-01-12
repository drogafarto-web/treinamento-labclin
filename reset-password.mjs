import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xvwyhpsquacrfleiabny.supabase.co';
// Usando a serviceRoleKey fornecida anteriormente para ter permissões de ADMIN
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2d3locHNxdWFjcmZsZWlhYm55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5MTUzNCwiZXhwIjoyMDgzNDY3NTM0fQ.Fao_Av3TW-Nqa4yNJEiKLSopN-76tEK6_jT8mQPDDHU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

(async () => {
  console.log("🔄 Iniciando redefinição de senha para drogafarto@gmail.com...");

  try {
    // 1. Listar usuários para encontrar o ID (A API de Admin precisa do ID para update seguro)
    const { data, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    // Safe fallback for users array
    const users = data?.users || [];
    const user = users.find(u => u.email === 'drogafarto@gmail.com');

    if (!user) {
      console.error("❌ Usuário drogafarto@gmail.com não encontrado no Auth.");
      // @ts-ignore
      process.exit(1);
    }

    console.log(`👤 ID do usuário encontrado: ${user.id}`);

    // 2. Forçar atualização da senha e CONFIRMAÇÃO DO EMAIL
    // 'email_confirm: true' é crucial para evitar o erro "Email not confirmed" que impede o login
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        password: '123456',
        email_confirm: true, 
        user_metadata: { email_verified: true } 
      }
    );

    if (updateError) throw updateError;
    console.log("✅ Senha definida como '123456' e E-mail marcado como CONFIRMADO.");

    // 3. Atualizar tabela employees para remover a flag de 'troca obrigatória'
    const { error: dbError } = await supabase
      .from('employees')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (dbError) {
       console.warn("⚠️ Senha trocada, mas houve erro ao atualizar tabela employees (provável RLS):", dbError.message);
    } else {
       console.log("✅ Flag 'must_change_password' removida da tabela employees.");
    }

  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    // @ts-ignore
    process.exit(1);
  } finally {
    // @ts-ignore
    process.exit(0);
  }
})();