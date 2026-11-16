-- Migration 002: Índices para chaves estrangeiras, consultas frequentes e unicidade case-insensitive de e-mails

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_email_lower
  ON members (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_projects_creator_user_id
  ON projects (creator_user_id);

CREATE INDEX IF NOT EXISTS idx_projects_presentation_date
  ON projects (presentation_date, presentation_time);

CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON members (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_members_project_id
  ON project_members (project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_member_id
  ON project_members (member_id);

CREATE INDEX IF NOT EXISTS idx_project_sections_project_sort
  ON project_sections (project_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_project_sections_pdf_document_id
  ON project_sections (pdf_document_id)
  WHERE pdf_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_sections_assigned_member_id
  ON project_sections (assigned_member_id)
  WHERE assigned_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_presentation_slides_project_slide_number
  ON presentation_slides (project_id, slide_number);

CREATE INDEX IF NOT EXISTS idx_presentation_slides_google_pres_id
  ON presentation_slides (google_presentation_id)
  WHERE google_presentation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_preparations_project_id
  ON member_preparations (project_id);

CREATE INDEX IF NOT EXISTS idx_member_preparations_member_id
  ON member_preparations (member_id);

CREATE INDEX IF NOT EXISTS idx_rehearsals_project_date
  ON rehearsals (project_id, date, time);

CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_project_id
  ON email_dispatch_logs (project_id);

CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_member_id
  ON email_dispatch_logs (member_id);
