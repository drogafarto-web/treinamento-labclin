# Arquitetura do Sistema de Educação Continuada (RDC 978/2025)

## 1. Resumo Executivo
Este sistema é um Learning Management System (LMS) verticalizado para Laboratórios de Análises Clínicas. Ele resolve a dor de rastreabilidade e comprovação de competência exigida pela RDC 978/2025. A solução centraliza documentos (POPs), planos de aula e registros de execução, garantindo que cada colaborador tenha um histórico imutável de capacitação.

## 2. Diferenciais Técnicos
- **Supabase Backend:** Utiliza PostgreSQL para integridade relacional robusta e Supabase Auth para gestão de identidades.
- **Segurança (RLS):** Dados segregados nativamente no banco. Um gestor da Unidade A não consegue ler querys da Unidade B, mesmo que o frontend falhe.
- **IA Ready:** Camada de serviço preparada para ingerir POPs (text/pdf) e gerar quizzes automaticamente via Gemini, reduzindo o tempo de criação de conteúdo pelo setor da Qualidade.

## 3. Diagrama Lógico de Entidades

[UNIDADE] 1 --- N [SETOR]
                    |
                    1
                    |
[COLABORADOR] N --- 1 [FUNÇÃO/CARGO]
      |                     |
      |                     N
      |           [MATRIZ DE TREINAMENTO] (Obrigatoriedade)
      |                     1
      |                     |
      N                     1
[MATRÍCULA] N --- 1 [CRONOGRAMA] N --- 1 [MÓDULO DE TREINAMENTO] 1 --- 1 [POP]
      |                                           |
      1                                           1
[TENTATIVA QUIZ] N ---------------------- [BANCO DE QUESTÕES]

## 4. Fluxo de Garantia da Qualidade
1. **Planejamento:** Gestor cria Cronograma Anual (`training_schedule`) baseado na Matriz de Risco.
2. **Execução:** Colaborador recebe link, estuda o POP/Vídeo.
3. **Validação:** Colaborador assina eletronicamente e realiza Quiz.
4. **Evidência:** Se nota >= corte, gera Certificado com hash de validação.
5. **Eficácia:** Após 30 dias, gestor registra indicadores (ex: redução de recoleta) na tabela `training_schedule`.

## 5. Stack Tecnológica
- **Frontend:** React + Tailwind (Responsivo para acesso em bancada/mobile).
- **Database:** PostgreSQL (Supabase).
- **Storage:** Supabase Storage (Para vídeo aulas e PDFs dos POPs).
- **AI:** Google Gemini (Geração de conteúdo) e OpenAI (Fallback).
