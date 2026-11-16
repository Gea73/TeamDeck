import {
  ContentSectionStatus,
  GooglePresentationMetadata,
  PdfDocument,
  PresentationSlide,
  RehearsalSession,
  RehearsalStatus,
} from '../../src/types';
import {
  PdfStructuredAnalysis,
  PdfVisualElement,
} from '../../src/types/pdfAnalysis';
import {
  AudienceQuestionAnswer,
  MemberPreparationMaterial,
  PracticalExampleItem,
  PreparationReviewStatus,
  PreparationScriptBlock,
  SlideTransitionSuggestion,
  TechnicalConceptExplanation,
} from '../../src/types/preparation';
import {
  EmailDispatchLog,
  RehearsalReminderConfig,
} from '../../src/types/workspace';
import { DbClient, dbQuery } from '../db/pool';

export interface DbPdfDocumentRecord {
  projectId: string;
  document: PdfDocument;
  fileSizeBytes: number | null;
  model: string | null;
  analyzedAt: string | null;
}

export interface DbProjectSectionRecord {
  id: string;
  projectId: string;
  pdfDocumentId: string | null;
  parentSectionId: string | null;
  sortOrder: number;
  level: number;
  title: string;
  summary: string;
  mainTopics: string[];
  visualElements: PdfVisualElement[];
  sourcePages: number[];
  assignedMemberId: string | null;
  estimatedMinutes: number;
  status: ContentSectionStatus;
}

export interface DbGooglePresentationRecord {
  rowId: string;
  projectId: string;
  metadata: GooglePresentationMetadata;
}

interface PdfDocumentRow {
  id: string;
  project_id: string;
  file_name: string;
  file_size: string;
  file_size_bytes: string | number | null;
  page_count: number;
  uploaded_at: Date | string;
  uploaded_by: string;
  summary: string;
  extracted_topics: string[];
  analysis_json: PdfStructuredAnalysis | null;
  model: string | null;
  analyzed_at: Date | string | null;
}

interface ProjectSectionRow {
  id: string;
  project_id: string;
  pdf_document_id: string | null;
  parent_section_id: string | null;
  sort_order: number;
  level: number;
  title: string;
  summary: string;
  main_topics: string[];
  visual_elements: PdfVisualElement[];
  source_pages: number[];
  assigned_member_id: string | null;
  estimated_minutes: number;
  status: ContentSectionStatus;
}

interface GooglePresentationRow {
  id: string;
  project_id: string;
  presentation_id: string;
  presentation_url: string;
  title: string;
  slide_count: number;
  approved_section_ids: string[];
  generated_at: Date | string;
}

interface PresentationSlideRow {
  id: string;
  project_id: string;
  slide_number: number;
  title: string;
  subtitle: string;
  bullet_points: string[];
  speaker_notes: string;
  assigned_member_name: string;
  duration_minutes: number;
  duration_seconds: number | null;
  layout_type: PresentationSlide['layoutType'] | null;
  source_pages: number[];
  visual_callouts: string[];
}

interface MemberPreparationRow {
  id: string;
  project_id: string;
  member_id: string;
  member_name: string;
  member_role: string;
  assigned_section_ids: string[];
  assigned_section_titles: string[];
  calculated_duration_seconds: number;
  total_target_word_count: number;
  overview_summary: string;
  detailed_script: PreparationScriptBlock[];
  technical_concepts: TechnicalConceptExplanation[];
  practical_examples: PracticalExampleItem[];
  audience_questions: AudienceQuestionAnswer[];
  slide_transitions: SlideTransitionSuggestion[];
  reviewed_sections: PreparationReviewStatus;
  all_reviewed: boolean;
  model: string;
  generated_at: Date | string;
  updated_at: Date | string;
  reviewed_at: Date | string | null;
}

interface RehearsalRow {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  date: Date | string;
  time: string;
  location: string;
  modality: 'Presencial' | 'Online';
  duration_minutes: number;
  status: RehearsalStatus;
  notes: string;
  attendee_emails: string[];
  meeting_link: string | null;
  reminders: RehearsalReminderConfig[];
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  google_meet_link: string | null;
  synced_at: Date | string | null;
}

interface EmailDispatchLogRow {
  id: string;
  project_id: string;
  member_id: string;
  member_name: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  status: 'sent' | 'failed';
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  error_message: string | null;
  attempt_count: number;
  last_attempt_at: Date | string;
  sent_at: Date | string | null;
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function toIsoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export const projectArtifactRepository = {
  // ---- PDF DOCUMENTS ----
  async findPdfDocumentsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<DbPdfDocumentRecord[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<PdfDocumentRow>(
      `SELECT id, project_id, file_name, file_size, file_size_bytes, page_count,
              uploaded_at, uploaded_by, summary, extracted_topics, analysis_json, model, analyzed_at
       FROM pdf_documents
       WHERE project_id = ANY($1::text[])`,
      [projectIds],
      client
    );

    return res.rows.map((row) => ({
      projectId: row.project_id,
      fileSizeBytes:
        row.file_size_bytes !== null ? Number(row.file_size_bytes) : null,
      model: row.model,
      analyzedAt: row.analyzed_at ? toIsoTimestamp(row.analyzed_at) : null,
      document: {
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        pageCount: row.page_count,
        uploadedAt: toIsoDate(row.uploaded_at),
        uploadedBy: row.uploaded_by,
        summary: row.summary,
        extractedTopics: Array.isArray(row.extracted_topics)
          ? row.extracted_topics
          : [],
        analysis: row.analysis_json ?? null,
      },
    }));
  },

  async upsertPdfDocument(
    input: {
      id: string;
      projectId: string;
      fileName: string;
      fileSize: string;
      fileSizeBytes?: number | null;
      pageCount: number;
      uploadedAt: string;
      uploadedBy: string;
      summary: string;
      extractedTopics: string[];
      analysis?: PdfStructuredAnalysis | null;
      model?: string | null;
      analyzedAt?: string | null;
    },
    client?: DbClient
  ): Promise<string> {
    const res = await dbQuery<{ id: string }>(
      `INSERT INTO pdf_documents (
         id, project_id, file_name, file_size, file_size_bytes, page_count,
         uploaded_at, uploaded_by, summary, extracted_topics, analysis_json, model, analyzed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10::jsonb, $11::jsonb, $12, $13)
       ON CONFLICT (project_id) DO UPDATE SET
         file_name = EXCLUDED.file_name,
         file_size = EXCLUDED.file_size,
         file_size_bytes = EXCLUDED.file_size_bytes,
         page_count = EXCLUDED.page_count,
         uploaded_at = EXCLUDED.uploaded_at,
         uploaded_by = EXCLUDED.uploaded_by,
         summary = EXCLUDED.summary,
         extracted_topics = EXCLUDED.extracted_topics,
         analysis_json = EXCLUDED.analysis_json,
         model = EXCLUDED.model,
         analyzed_at = EXCLUDED.analyzed_at
       RETURNING id`,
      [
        input.id,
        input.projectId,
        input.fileName,
        input.fileSize,
        input.fileSizeBytes ?? null,
        input.pageCount,
        input.uploadedAt,
        input.uploadedBy,
        input.summary,
        JSON.stringify(input.extractedTopics),
        input.analysis ? JSON.stringify(input.analysis) : null,
        input.model ?? null,
        input.analyzedAt ?? null,
      ],
      client
    );
    return res.rows[0].id;
  },

  async deletePdfDocumentsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM pdf_documents WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  // ---- PROJECT SECTIONS & ASSIGNMENTS ----
  async findSectionsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<DbProjectSectionRecord[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<ProjectSectionRow>(
      `SELECT id, project_id, pdf_document_id, parent_section_id, sort_order, level,
              title, summary, main_topics, visual_elements, source_pages,
              assigned_member_id, estimated_minutes, status
       FROM project_sections
       WHERE project_id = ANY($1::text[])
       ORDER BY sort_order ASC`,
      [projectIds],
      client
    );

    return res.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      pdfDocumentId: row.pdf_document_id,
      parentSectionId: row.parent_section_id,
      sortOrder: row.sort_order,
      level: row.level,
      title: row.title,
      summary: row.summary,
      mainTopics: Array.isArray(row.main_topics) ? row.main_topics : [],
      visualElements: Array.isArray(row.visual_elements)
        ? row.visual_elements
        : [],
      sourcePages: Array.isArray(row.source_pages) ? row.source_pages : [],
      assignedMemberId: row.assigned_member_id,
      estimatedMinutes: row.estimated_minutes,
      status: row.status,
    }));
  },

  async replaceProjectSections(
    projectId: string,
    sections: Array<{
      id: string;
      pdfDocumentId: string | null;
      parentSectionId: string | null;
      sortOrder: number;
      level: number;
      title: string;
      summary: string;
      mainTopics: string[];
      visualElements: PdfVisualElement[];
      sourcePages: number[];
      assignedMemberId: string | null;
      estimatedMinutes: number;
      status: ContentSectionStatus;
    }>,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `UPDATE project_sections SET parent_section_id = NULL WHERE project_id = $1`,
      [projectId],
      client
    );
    await dbQuery(
      `DELETE FROM project_sections WHERE project_id = $1`,
      [projectId],
      client
    );

    for (const sec of sections) {
      await dbQuery(
        `INSERT INTO project_sections (
           id, project_id, pdf_document_id, parent_section_id, sort_order, level,
           title, summary, main_topics, visual_elements, source_pages,
           assigned_member_id, estimated_minutes, status
         )
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13)`,
        [
          sec.id,
          projectId,
          sec.pdfDocumentId,
          sec.sortOrder,
          sec.level,
          sec.title,
          sec.summary,
          JSON.stringify(sec.mainTopics),
          JSON.stringify(sec.visualElements),
          JSON.stringify(sec.sourcePages),
          sec.assignedMemberId,
          sec.estimatedMinutes,
          sec.status,
        ],
        client
      );
    }

    // Vincula parent_section_id apenas após todas as seções inseridas
    for (const sec of sections) {
      if (sec.parentSectionId) {
        await dbQuery(
          `UPDATE project_sections
           SET parent_section_id = $2
           WHERE id = $1 AND project_id = $3`,
          [sec.id, sec.parentSectionId, projectId],
          client
        );
      }
    }
  },

  async updateSectionAssignment(
    projectId: string,
    sectionId: string,
    memberId: string | null,
    client?: DbClient
  ): Promise<boolean> {
    const res = await dbQuery(
      `UPDATE project_sections
       SET assigned_member_id = $3,
           updated_at = NOW()
       WHERE project_id = $1 AND id = $2`,
      [projectId, sectionId, memberId],
      client
    );
    return (res.rowCount ?? 0) > 0;
  },

  async clearMemberFromSections(
    memberId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `UPDATE project_sections
       SET assigned_member_id = NULL,
           updated_at = NOW()
       WHERE assigned_member_id = $1`,
      [memberId],
      client
    );
  },

  async deleteSectionsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `UPDATE project_sections SET parent_section_id = NULL WHERE project_id = $1`,
      [projectId],
      client
    );
    await dbQuery(
      `DELETE FROM project_sections WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  // ---- GOOGLE PRESENTATIONS & SLIDES ----
  async findGooglePresentationsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<DbGooglePresentationRecord[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<GooglePresentationRow>(
      `SELECT id, project_id, presentation_id, presentation_url, title, slide_count, approved_section_ids, generated_at
       FROM google_presentations
       WHERE project_id = ANY($1::text[])`,
      [projectIds],
      client
    );
    return res.rows.map((row) => ({
      rowId: row.id,
      projectId: row.project_id,
      metadata: {
        presentationId: row.presentation_id,
        presentationUrl: row.presentation_url,
        title: row.title,
        slideCount: row.slide_count,
        approvedSectionIds: Array.isArray(row.approved_section_ids)
          ? row.approved_section_ids
          : [],
        generatedAt: toIsoTimestamp(row.generated_at),
      },
    }));
  },

  async upsertGooglePresentation(
    input: {
      rowId: string;
      projectId: string;
      metadata: GooglePresentationMetadata;
    },
    client?: DbClient
  ): Promise<string> {
    const res = await dbQuery<{ id: string }>(
      `INSERT INTO google_presentations (
         id, project_id, presentation_id, presentation_url, title, slide_count, approved_section_ids, generated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (project_id) DO UPDATE SET
         presentation_id = EXCLUDED.presentation_id,
         presentation_url = EXCLUDED.presentation_url,
         title = EXCLUDED.title,
         slide_count = EXCLUDED.slide_count,
         approved_section_ids = EXCLUDED.approved_section_ids,
         generated_at = EXCLUDED.generated_at
       RETURNING id`,
      [
        input.rowId,
        input.projectId,
        input.metadata.presentationId,
        input.metadata.presentationUrl,
        input.metadata.title,
        input.metadata.slideCount,
        JSON.stringify(input.metadata.approvedSectionIds),
        input.metadata.generatedAt,
      ],
      client
    );
    return res.rows[0].id;
  },

  async deleteGooglePresentationsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM google_presentations WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  async findSlidesByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<Array<{ projectId: string; slide: PresentationSlide }>> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<PresentationSlideRow>(
      `SELECT id, project_id, slide_number, title, subtitle, bullet_points, speaker_notes,
              assigned_member_name, duration_minutes, duration_seconds, layout_type,
              source_pages, visual_callouts
       FROM presentation_slides
       WHERE project_id = ANY($1::text[])
       ORDER BY slide_number ASC`,
      [projectIds],
      client
    );
    return res.rows.map((row) => ({
      projectId: row.project_id,
      slide: {
        id: row.id,
        slideNumber: row.slide_number,
        title: row.title,
        subtitle: row.subtitle,
        bulletPoints: Array.isArray(row.bullet_points) ? row.bullet_points : [],
        speakerNotes: row.speaker_notes,
        assignedMemberName: row.assigned_member_name,
        durationMinutes: row.duration_minutes,
        durationSeconds: row.duration_seconds ?? undefined,
        layoutType: row.layout_type ?? undefined,
        sourcePages: Array.isArray(row.source_pages) ? row.source_pages : undefined,
        visualCallouts: Array.isArray(row.visual_callouts)
          ? row.visual_callouts
          : undefined,
      },
    }));
  },

  async replaceProjectSlides(
    projectId: string,
    googlePresentationRowId: string | null,
    slides: PresentationSlide[],
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM presentation_slides WHERE project_id = $1`,
      [projectId],
      client
    );

    for (const slide of slides) {
      await dbQuery(
        `INSERT INTO presentation_slides (
           id, project_id, google_presentation_id, slide_number, title, subtitle,
           bullet_points, speaker_notes, assigned_member_name, duration_minutes,
           duration_seconds, layout_type, source_pages, visual_callouts
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)`,
        [
          slide.id,
          projectId,
          googlePresentationRowId,
          slide.slideNumber,
          slide.title,
          slide.subtitle,
          JSON.stringify(slide.bulletPoints ?? []),
          slide.speakerNotes,
          slide.assignedMemberName,
          slide.durationMinutes,
          slide.durationSeconds ?? null,
          slide.layoutType ?? null,
          JSON.stringify(slide.sourcePages ?? []),
          JSON.stringify(slide.visualCallouts ?? []),
        ],
        client
      );
    }
  },

  async deleteSlidesByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM presentation_slides WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  // ---- MEMBER PREPARATIONS ----
  async findPreparationsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<MemberPreparationMaterial[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<MemberPreparationRow>(
      `SELECT id, project_id, member_id, member_name, member_role, assigned_section_ids,
              assigned_section_titles, calculated_duration_seconds, total_target_word_count,
              overview_summary, detailed_script, technical_concepts, practical_examples,
              audience_questions, slide_transitions, reviewed_sections, all_reviewed,
              model, generated_at, updated_at, reviewed_at
       FROM member_preparations
       WHERE project_id = ANY($1::text[])
       ORDER BY updated_at DESC`,
      [projectIds],
      client
    );

    return res.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      memberId: row.member_id,
      memberName: row.member_name,
      memberRole: row.member_role,
      assignedSectionIds: row.assigned_section_ids ?? [],
      assignedSectionTitles: row.assigned_section_titles ?? [],
      calculatedDurationSeconds: row.calculated_duration_seconds,
      totalTargetWordCount: row.total_target_word_count,
      overviewSummary: row.overview_summary,
      detailedScript: row.detailed_script ?? [],
      technicalConcepts: row.technical_concepts ?? [],
      practicalExamples: row.practical_examples ?? [],
      audienceQuestions: row.audience_questions ?? [],
      slideTransitions: row.slide_transitions ?? [],
      reviewedSections: row.reviewed_sections,
      allReviewed: row.all_reviewed,
      model: row.model,
      generatedAt: toIsoTimestamp(row.generated_at),
      updatedAt: toIsoTimestamp(row.updated_at),
      reviewedAt: row.reviewed_at ? toIsoTimestamp(row.reviewed_at) : null,
    }));
  },

  async findPreparationById(
    preparationId: string,
    client?: DbClient
  ): Promise<MemberPreparationMaterial | null> {
    const res = await dbQuery<MemberPreparationRow>(
      `SELECT id, project_id, member_id, member_name, member_role, assigned_section_ids,
              assigned_section_titles, calculated_duration_seconds, total_target_word_count,
              overview_summary, detailed_script, technical_concepts, practical_examples,
              audience_questions, slide_transitions, reviewed_sections, all_reviewed,
              model, generated_at, updated_at, reviewed_at
       FROM member_preparations
       WHERE id = $1`,
      [preparationId],
      client
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      memberId: row.member_id,
      memberName: row.member_name,
      memberRole: row.member_role,
      assignedSectionIds: row.assigned_section_ids ?? [],
      assignedSectionTitles: row.assigned_section_titles ?? [],
      calculatedDurationSeconds: row.calculated_duration_seconds,
      totalTargetWordCount: row.total_target_word_count,
      overviewSummary: row.overview_summary,
      detailedScript: row.detailed_script ?? [],
      technicalConcepts: row.technical_concepts ?? [],
      practicalExamples: row.practical_examples ?? [],
      audienceQuestions: row.audience_questions ?? [],
      slideTransitions: row.slide_transitions ?? [],
      reviewedSections: row.reviewed_sections,
      allReviewed: row.all_reviewed,
      model: row.model,
      generatedAt: toIsoTimestamp(row.generated_at),
      updatedAt: toIsoTimestamp(row.updated_at),
      reviewedAt: row.reviewed_at ? toIsoTimestamp(row.reviewed_at) : null,
    };
  },

  async upsertPreparation(
    material: MemberPreparationMaterial,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `INSERT INTO member_preparations (
         id, project_id, member_id, member_name, member_role, assigned_section_ids,
         assigned_section_titles, calculated_duration_seconds, total_target_word_count,
         overview_summary, detailed_script, technical_concepts, practical_examples,
         audience_questions, slide_transitions, reviewed_sections, all_reviewed,
         model, generated_at, updated_at, reviewed_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10,
         $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb,
         $16::jsonb, $17, $18, $19, $20, $21
       )
       ON CONFLICT (project_id, member_id) DO UPDATE SET
         member_name = EXCLUDED.member_name,
         member_role = EXCLUDED.member_role,
         assigned_section_ids = EXCLUDED.assigned_section_ids,
         assigned_section_titles = EXCLUDED.assigned_section_titles,
         calculated_duration_seconds = EXCLUDED.calculated_duration_seconds,
         total_target_word_count = EXCLUDED.total_target_word_count,
         overview_summary = EXCLUDED.overview_summary,
         detailed_script = EXCLUDED.detailed_script,
         technical_concepts = EXCLUDED.technical_concepts,
         practical_examples = EXCLUDED.practical_examples,
         audience_questions = EXCLUDED.audience_questions,
         slide_transitions = EXCLUDED.slide_transitions,
         reviewed_sections = EXCLUDED.reviewed_sections,
         all_reviewed = EXCLUDED.all_reviewed,
         model = EXCLUDED.model,
         generated_at = EXCLUDED.generated_at,
         updated_at = EXCLUDED.updated_at,
         reviewed_at = EXCLUDED.reviewed_at`,
      [
        material.id,
        material.projectId,
        material.memberId,
        material.memberName,
        material.memberRole,
        JSON.stringify(material.assignedSectionIds),
        JSON.stringify(material.assignedSectionTitles),
        material.calculatedDurationSeconds,
        material.totalTargetWordCount,
        material.overviewSummary,
        JSON.stringify(material.detailedScript),
        JSON.stringify(material.technicalConcepts),
        JSON.stringify(material.practicalExamples),
        JSON.stringify(material.audienceQuestions),
        JSON.stringify(material.slideTransitions),
        JSON.stringify(material.reviewedSections),
        material.allReviewed,
        material.model,
        material.generatedAt,
        material.updatedAt,
        material.reviewedAt,
      ],
      client
    );
  },

  async deletePreparationsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM member_preparations WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  async deletePreparationsByMemberId(
    memberId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM member_preparations WHERE member_id = $1`,
      [memberId],
      client
    );
  },

  // ---- REHEARSALS ----
  async findRehearsalsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<RehearsalSession[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<RehearsalRow>(
      `SELECT r.id, r.project_id, p.title AS project_name, r.title, r.description,
              r.date, r.time, r.location, r.modality, r.duration_minutes, r.status,
              r.notes, r.attendee_emails, r.meeting_link, r.reminders,
              r.google_calendar_event_id, r.google_calendar_html_link,
              r.google_meet_link, r.synced_at
       FROM rehearsals r
       INNER JOIN projects p ON p.id = r.project_id
       WHERE r.project_id = ANY($1::text[])
       ORDER BY r.date ASC, r.time ASC`,
      [projectIds],
      client
    );

    return res.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      title: row.title,
      description: row.description,
      date: toIsoDate(row.date),
      time: row.time,
      location: row.location,
      modality: row.modality,
      durationMinutes: row.duration_minutes,
      status: row.status,
      notes: row.notes,
      attendeeEmails: Array.isArray(row.attendee_emails)
        ? row.attendee_emails
        : undefined,
      meetingLink: row.meeting_link ?? undefined,
      reminders: Array.isArray(row.reminders) ? row.reminders : undefined,
      googleCalendarEventId: row.google_calendar_event_id,
      googleCalendarHtmlLink: row.google_calendar_html_link,
      googleMeetLink: row.google_meet_link,
      syncedAt: row.synced_at ? toIsoTimestamp(row.synced_at) : null,
    }));
  },

  async createRehearsal(
    rehearsal: RehearsalSession,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `INSERT INTO rehearsals (
         id, project_id, title, description, date, time, location, modality,
         duration_minutes, status, notes, attendee_emails, meeting_link, reminders,
         google_calendar_event_id, google_calendar_html_link, google_meet_link, synced_at
       )
       VALUES (
         $1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11,
         $12::jsonb, $13, $14::jsonb, $15, $16, $17, $18
       )`,
      [
        rehearsal.id,
        rehearsal.projectId,
        rehearsal.title,
        rehearsal.description ?? '',
        rehearsal.date,
        rehearsal.time,
        rehearsal.location,
        rehearsal.modality,
        rehearsal.durationMinutes,
        rehearsal.status,
        rehearsal.notes,
        JSON.stringify(rehearsal.attendeeEmails ?? []),
        rehearsal.meetingLink ?? null,
        JSON.stringify(rehearsal.reminders ?? []),
        rehearsal.googleCalendarEventId ?? null,
        rehearsal.googleCalendarHtmlLink ?? null,
        rehearsal.googleMeetLink ?? null,
        rehearsal.syncedAt ?? null,
      ],
      client
    );
  },

  async deleteRehearsalsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM rehearsals WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  // ---- EMAIL DISPATCH LOGS ----
  async findEmailLogsByProjectIds(
    projectIds: string[],
    client?: DbClient
  ): Promise<EmailDispatchLog[]> {
    if (projectIds.length === 0) return [];
    const res = await dbQuery<EmailDispatchLogRow>(
      `SELECT id, project_id, member_id, member_name, recipient_email, subject, body_text,
              status, gmail_message_id, gmail_thread_id, error_message, attempt_count,
              last_attempt_at, sent_at
       FROM email_dispatch_logs
       WHERE project_id = ANY($1::text[])
       ORDER BY last_attempt_at DESC`,
      [projectIds],
      client
    );
    return res.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      memberId: row.member_id,
      memberName: row.member_name,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      bodyText: row.body_text,
      status: row.status,
      gmailMessageId: row.gmail_message_id,
      gmailThreadId: row.gmail_thread_id,
      errorMessage: row.error_message,
      attemptCount: row.attempt_count,
      lastAttemptAt: toIsoTimestamp(row.last_attempt_at),
      sentAt: row.sent_at ? toIsoTimestamp(row.sent_at) : null,
    }));
  },

  async upsertEmailLog(
    log: Omit<EmailDispatchLog, 'attemptCount'>,
    client?: DbClient
  ): Promise<EmailDispatchLog> {
    const res = await dbQuery<EmailDispatchLogRow>(
      `INSERT INTO email_dispatch_logs (
         id, project_id, member_id, member_name, recipient_email, subject, body_text,
         status, gmail_message_id, gmail_thread_id, error_message, attempt_count,
         last_attempt_at, sent_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13)
       ON CONFLICT (project_id, member_id) DO UPDATE SET
         member_name = EXCLUDED.member_name,
         recipient_email = EXCLUDED.recipient_email,
         subject = EXCLUDED.subject,
         body_text = EXCLUDED.body_text,
         status = EXCLUDED.status,
         gmail_message_id = EXCLUDED.gmail_message_id,
         gmail_thread_id = EXCLUDED.gmail_thread_id,
         error_message = EXCLUDED.error_message,
         attempt_count = email_dispatch_logs.attempt_count + 1,
         last_attempt_at = EXCLUDED.last_attempt_at,
         sent_at = COALESCE(EXCLUDED.sent_at, email_dispatch_logs.sent_at)
       RETURNING id, project_id, member_id, member_name, recipient_email, subject, body_text,
                 status, gmail_message_id, gmail_thread_id, error_message, attempt_count,
                 last_attempt_at, sent_at`,
      [
        log.id,
        log.projectId,
        log.memberId,
        log.memberName,
        log.recipientEmail,
        log.subject,
        log.bodyText,
        log.status,
        log.gmailMessageId,
        log.gmailThreadId,
        log.errorMessage,
        log.lastAttemptAt,
        log.sentAt,
      ],
      client
    );
    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      memberId: row.member_id,
      memberName: row.member_name,
      recipientEmail: row.recipient_email,
      subject: row.subject,
      bodyText: row.body_text,
      status: row.status,
      gmailMessageId: row.gmail_message_id,
      gmailThreadId: row.gmail_thread_id,
      errorMessage: row.error_message,
      attemptCount: row.attempt_count,
      lastAttemptAt: toIsoTimestamp(row.last_attempt_at),
      sentAt: row.sent_at ? toIsoTimestamp(row.sent_at) : null,
    };
  },

  async deleteEmailLogsByProjectId(
    projectId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM email_dispatch_logs WHERE project_id = $1`,
      [projectId],
      client
    );
  },

  async deleteEmailLogsByMemberId(
    memberId: string,
    client?: DbClient
  ): Promise<void> {
    await dbQuery(
      `DELETE FROM email_dispatch_logs WHERE member_id = $1`,
      [memberId],
      client
    );
  },
};
