-- Rollback da Migration 001 em ordem topológica segura (dependências antes de pais)

DROP TABLE IF EXISTS email_dispatch_logs;
DROP TABLE IF EXISTS rehearsals;
DROP TABLE IF EXISTS member_preparations;
DROP TABLE IF EXISTS presentation_slides;
DROP TABLE IF EXISTS google_presentations;
DROP TABLE IF EXISTS project_sections;
DROP TABLE IF EXISTS pdf_documents;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS users;
