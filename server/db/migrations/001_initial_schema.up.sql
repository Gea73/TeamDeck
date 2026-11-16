-- Migration 001: Estrutura relacional inicial do TeamDeck
-- Comportamento de ON DELETE definido explicitamente por relacionamento (sem CASCADE indiscriminado)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  email TEXT NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  course TEXT NOT NULL DEFAULT '',
  institution TEXT NOT NULL DEFAULT '',
  semester TEXT NOT NULL DEFAULT '',
  registration_id TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Estudante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  rehearsal_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  email_digest BOOLEAN NOT NULL DEFAULT FALSE,
  show_timer_warnings BOOLEAN NOT NULL DEFAULT TRUE,
  default_slide_duration INTEGER NOT NULL DEFAULT 2 CHECK (default_slide_duration BETWEEN 1 AND 30),
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo (GMT-3)',
  academic_period TEXT NOT NULL DEFAULT '2026.2',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 10),
  discipline TEXT NOT NULL CHECK (char_length(trim(discipline)) >= 1),
  institution TEXT NOT NULL DEFAULT '',
  advisor TEXT NOT NULL DEFAULT 'A definir',
  presentation_date DATE NOT NULL,
  presentation_time VARCHAR(5) NOT NULL CHECK (presentation_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location TEXT NOT NULL CHECK (char_length(trim(location)) >= 1),
  target_duration_minutes INTEGER NOT NULL CHECK (target_duration_minutes BETWEEN 5 AND 180),
  status TEXT NOT NULL CHECK (status IN ('Planejamento', 'Em andamento', 'Em ensaio', 'Concluído')),
  base_progress INTEGER NOT NULL DEFAULT 10 CHECK (base_progress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  email TEXT NOT NULL UNIQUE CHECK (position('@' in email) > 1),
  default_role TEXT NOT NULL CHECK (char_length(trim(default_role)) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (char_length(trim(role)) >= 1),
  responsibility TEXT NOT NULL CHECK (char_length(trim(responsibility)) >= 1),
  presentation_minutes INTEGER NOT NULL CHECK (presentation_minutes BETWEEN 1 AND 120),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  tasks_completed INTEGER NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  tasks_total INTEGER NOT NULL DEFAULT 4 CHECK (tasks_total >= 1 AND tasks_completed <= tasks_total),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, member_id)
);

CREATE TABLE IF NOT EXISTS pdf_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) >= 1),
  file_size TEXT NOT NULL,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count >= 1),
  uploaded_at DATE NOT NULL,
  uploaded_by TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  extracted_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_json JSONB,
  model TEXT,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_sections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  pdf_document_id TEXT REFERENCES pdf_documents(id) ON DELETE SET NULL,
  parent_section_id TEXT REFERENCES project_sections(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 6),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 1),
  summary TEXT NOT NULL DEFAULT '',
  main_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 1 CHECK (estimated_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em redação', 'Revisado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_presentations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  presentation_id TEXT NOT NULL CHECK (char_length(trim(presentation_id)) >= 1),
  presentation_url TEXT NOT NULL CHECK (char_length(trim(presentation_url)) >= 1),
  title TEXT NOT NULL,
  slide_count INTEGER NOT NULL CHECK (slide_count >= 1),
  approved_section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presentation_slides (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  google_presentation_id TEXT REFERENCES google_presentations(id) ON DELETE SET NULL,
  slide_number INTEGER NOT NULL CHECK (slide_number >= 1),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  bullet_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  speaker_notes TEXT NOT NULL DEFAULT '',
  assigned_member_name TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 1 CHECK (duration_minutes >= 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  layout_type TEXT CHECK (
    layout_type IS NULL OR layout_type IN (
      'cover',
      'section_standard',
      'section_visual_split',
      'section_two_column',
      'conclusion'
    )
  ),
  source_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_callouts JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (project_id, slide_number)
);

CREATE TABLE IF NOT EXISTS member_preparations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL,
  assigned_section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_section_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_duration_seconds INTEGER NOT NULL CHECK (calculated_duration_seconds >= 0),
  total_target_word_count INTEGER NOT NULL CHECK (total_target_word_count >= 0),
  overview_summary TEXT NOT NULL DEFAULT '',
  detailed_script JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  practical_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  slide_transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_sections JSONB NOT NULL,
  all_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  model TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (project_id, member_id)
);

CREATE TABLE IF NOT EXISTS rehearsals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  time VARCHAR(5) NOT NULL CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL CHECK (modality IN ('Presencial', 'Online')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 10 AND 480),
  status TEXT NOT NULL CHECK (status IN ('Confirmado', 'Pendente', 'Realizado')),
  notes TEXT NOT NULL DEFAULT '',
  attendee_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  meeting_link TEXT,
  reminders JSONB NOT NULL DEFAULT '[]'::jsonb,
  google_calendar_event_id TEXT,
  google_calendar_html_link TEXT,
  google_meet_link TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_dispatch_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  member_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL CHECK (position('@' in recipient_email) > 1),
  subject TEXT NOT NULL CHECK (char_length(trim(subject)) >= 1),
  body_text TEXT NOT NULL CHECK (char_length(trim(body_text)) >= 1),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (project_id, member_id)
);
