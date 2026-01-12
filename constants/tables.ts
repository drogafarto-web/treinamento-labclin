
/**
 * Constantes de Tabelas do Supabase (Padronizado em Inglês)
 */
export const TABLES = {
  ROLES: 'roles',
  MODULES: 'training_modules',
  REQUIREMENTS: 'training_role_requirements',
  EMPLOYEES: 'employees',
  UNITS: 'units',
  SECTORS: 'sectors',
  LESSONS: 'training_lessons',
  SCHEDULE: 'training_schedule',
  ENROLLMENTS: 'enrollments'
} as const;

export const COLUMNS = {
  ROLE_ID: 'role_id',
  MODULE_ID: 'module_id'
} as const;
