
/**
 * Extrator de mensagens de erro robusto e amigável.
 * Garante que o retorno seja sempre uma string legível, sem [object Object].
 */
export const getErrorMessage = (error: any): string => {
  if (error === null || error === undefined) return "Erro desconhecido";
  
  // Recursão para objetos de erro aninhados (comum em wrappers)
  if (typeof error === 'object' && error.error && typeof error.error === 'object') {
    return getErrorMessage(error.error);
  }

  // 1. Se for uma string simples
  if (typeof error === 'string') {
    // Detecta se a string já é o erro genérico de objeto
    if (error === '[object Object]') return "Erro interno não detalhado (Objeto)";
    return error;
  }

  // 2. Tenta encontrar a mensagem em propriedades comuns
  const candidates = [
    error.message,
    error.error_description,
    error.details,
    error.hint,
    error.msg
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0 && candidate !== '[object Object]') {
      if (candidate.includes('JWT') || candidate.includes('claims')) {
        return "Sessão expirada. Recarregue a página ou faça login novamente.";
      }
      return candidate;
    }
  }

  // 3. Mapeamento por códigos de erro conhecidos do Postgres
  if (error.code) {
    const postgresErrors: Record<string, string> = {
      '42501': 'Acesso Negado (RLS): Você não tem permissão para realizar esta operação.',
      '23505': 'Registro Duplicado: Já existe um item com estes dados.',
      'PGRST116': 'Registro não encontrado.',
      '42P01': 'Tabela não encontrada no banco de dados.',
      '42703': 'Coluna não encontrada (Erro de Schema).',
    };
    if (postgresErrors[String(error.code)]) return postgresErrors[String(error.code)];
    
    return `Erro Técnico ${error.code}: Verifique os logs do sistema.`;
  }

  // 4. Fallback para objetos Error nativos que não foram capturados acima
  if (error instanceof Error) {
    // Evita retornar [object Object] se a mensagem for inútil
    if (error.message && error.message !== '[object Object]') return error.message;
    return error.name || "Erro de execução.";
  }

  // 5. Último recurso: Tentar serializar o objeto para JSON
  if (typeof error === 'object') {
    try {
      // Tenta pegar chaves para depuração se o stringify falhar em ser útil
      if (Object.keys(error).length === 0) {
         // Tenta acessar toString se não for o padrão
         const str = error.toString();
         if (str && str !== '[object Object]') return str;
      }

      // Tenta serializar propriedades comuns de erro se o stringify normal falhar (retornar {})
      const json = JSON.stringify(error, ['message', 'details', 'hint', 'code', 'status', 'statusText', 'error']);
      
      if (json && json !== '{}') {
        return json.length > 200 ? json.substring(0, 200) + '...' : json;
      }
      
      // Se falhar com propriedades específicas, tenta geral
      const fullJson = JSON.stringify(error);
      if (fullJson && fullJson !== '{}') {
         return fullJson.length > 200 ? fullJson.substring(0, 200) + '...' : fullJson;
      }
      
      // Se tudo falhar mas tiver chaves
      if (Object.keys(error).length > 0) {
        return "Erro desconhecido: " + Object.keys(error).join(', ');
      }
    } catch {
      return "Erro interno não serializável.";
    }
  }

  // 6. Fallback final
  return "Ocorreu um erro inesperado no processamento.";
};
