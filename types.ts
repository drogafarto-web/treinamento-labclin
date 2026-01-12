
// Enums for status and types
export enum TrainingType {
  ONBOARDING = 'ONBOARDING',
  TECNICO = 'TECNICO',
  BIOSSEGURANCA = 'BIOSSEGURANCA',
  QUALIDADE = 'QUALIDADE',
  RECICLAGEM = 'RECICLAGEM',
  RDC_UPDATE = 'RDC_UPDATE'
}

export enum EnrollmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED'
}

export enum UserRole {
  ADMIN = 'ADMIN',
  UNIT_MANAGER = 'UNIT_MANAGER',
  INSTRUCTOR = 'INSTRUCTOR',
  COLLABORATOR = 'COLLABORATOR'
}

export enum Frequency {
  ONCE = 'ONCE',
  ANNUAL = 'ANNUAL',
  BIANNUAL = 'BIANNUAL',
  EVERY_3_YEARS = 'EVERY_3_YEARS'
}

export enum ModuleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED'
}

export enum LessonContentType {
  VIDEO = 'VIDEO',
  PDF = 'PDF',
  LINK = 'LINK',
  TEXT = 'TEXT'
}

// Data Models matching SQL Schema
export interface Unit {
  id: string;
  name: string;
  address: string;
  technical_manager: string;
}

export interface Sector {
  id: string;
  unit_id: string;
  name: string;
}

export interface JobRole {
  id: string;
  name: string;
  is_critical_function: boolean; 
}

export interface Employee {
  id: string; 
  full_name: string;
  cpf: string;
  email?: string; // Added for management
  unit_id: string;
  sector_id: string;
  role_id: string; 
  system_role: UserRole;
  admission_date: string;
  must_change_password?: boolean;
  is_active: boolean;
  updated_at?: string;
  // Join data
  JobRole?: JobRole;
  Unit?: Unit;
  Sector?: Sector;
}

export interface TrainingRequirement {
  id: string;
  role_id: string; 
  module_id: string;
  is_mandatory: boolean;
  recertification_period_months: number | null;
}

export interface TrainingLesson {
  id: string;
  module_id: string;
  title: string;
  content_type: LessonContentType;
  content_url?: string;
  description?: string;
  order_index: number;
  created_at: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string; // Descrição longa
  short_description?: string; // Descrição curta (card)
  objectives?: string;
  training_type: TrainingType;
  duration_minutes: number; // Mantido para compatibilidade
  workload_hours?: number; // Novo campo
  min_score_approval: number;
  requires_quiz?: boolean;
  status?: ModuleStatus;
  rdc_reference?: string;
  pop_id?: string;
  created_at: string;
  updated_at?: string;
  lessons?: TrainingLesson[]; // Para carregamento com join
}

export interface TrainingSchedule {
  id: string;
  module_id: string;
  unit_id: string | null;
  instructor_id: string;
  start_date: string;
  end_date: string;
  status: 'PLANNED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
  TrainingModule?: TrainingModule;
}

export interface Enrollment {
  id: string;
  schedule_id: string;
  employee_id: string;
  status: EnrollmentStatus;
  progress_pct: number;
  completed_at?: string;
  final_score?: number;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  employee_id: string;
  verification_code: string;
  issued_at: string;
  pdf_storage_path?: string;
}

export interface ComplianceViewItem {
  employee_id: string;
  employee_name: string;
  role_name: string;
  module_id?: string;
  module_title: string;
  last_completion_date: string | null;
  next_due_date: string | null;
  days_remaining: number;
  status: 'OK' | 'WARNING' | 'EXPIRED' | 'MISSING';
  unit_id: string;
}

export interface AIQuizRequest {
  popText: string;
  numQuestions: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface AIEffectivenessRequest {
  feedback: string;
  errorRateBefore: number;
  errorRateAfter: number;
  nonConformities: number;
}
