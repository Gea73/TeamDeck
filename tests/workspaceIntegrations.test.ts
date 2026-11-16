import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import {
  buildPersonalizedMemberEmailDrafts,
  encodeMimeEmailToBase64Url,
  validateGmailMessageInput,
} from '../src/domain/gmailComposer';
import {
  buildGoogleCalendarEventPayload,
  computeEventStartEnd,
  validateCalendarRehearsalInput,
} from '../src/domain/googleCalendarBuilder';
import {
  createGoogleCalendarRehearsal,
  GoogleWorkspaceApiError,
  sendGmailMessage,
} from '../server/services/googleWorkspaceApiService';
import {
  _clearTokenVaultForTests,
  getGoogleSessionStatusFromRequest,
  GOOGLE_SESSION_COOKIE_NAME,
  GoogleTokenVaultError,
  resolveGoogleAccessTokenFromRequest,
  revokeAndDeleteGoogleSession,
  storeGoogleTokenSession,
  verifyGoogleAccessTokenWithGoogle,
} from '../server/services/googleTokenVault';
import {
  Project,
  ProjectStatus,
  TeamMemberAssignmentView,
} from '../src/types';
import { CreateCalendarRehearsalInput } from '../src/types/workspace';

function createSampleProjectAndMembers(): {
  project: Project;
  members: TeamMemberAssignmentView[];
} {
  const project: Project = {
    id: 'proj_1',
    title: 'Arquitetura Distribuída',
    description: 'Estudo de caso em sistemas distribuídos.',
    discipline: 'Sistemas Distribuídos',
    institution: 'USP',
    advisor: 'Prof. Dr. Marcos Silva',
    presentationDate: '2026-11-24',
    presentationTime: '19:30',
    location: 'Auditório B',
    targetDurationMinutes: 20,
    status: ProjectStatus.IN_PROGRESS,
    baseProgress: 50,
    memberCount: 2,
    overallProgress: 55,
    pdfDocument: {
      id: 'pdf_1',
      fileName: 'artigo.pdf',
      fileSize: '1.2 MB',
      pageCount: 10,
      uploadedAt: '2026-11-10',
      uploadedBy: 'Ana Clara',
      summary: 'Resumo',
      extractedTopics: ['Introdução', 'Resultados'],
      analysis: {
        documentTitle: 'Arquitetura Distribuída',
        documentTitleSourcePages: [1],
        mainObjective: {
          text: 'Analisar tolerância a falhas.',
          sourceType: 'explicit',
          sourcePages: [1],
        },
        introduction: {
          summary: 'Introdução ao problema.',
          explicitPoints: ['Escalabilidade horizontal.'],
          aiNotes: [],
          sourcePages: [1, 2],
        },
        sections: [
          {
            id: 'sec_1',
            parentSectionId: null,
            level: 1,
            title: 'Fundamentação e Filas',
            summary:
              'Explicação detalhada sobre filas assíncronas e balanceamento de carga entre nós.',
            mainTopics: ['Filas persistentes', 'Balanceamento'],
            visualElements: [],
            sourcePages: [2, 3],
          },
          {
            id: 'sec_2',
            parentSectionId: null,
            level: 1,
            title: 'Métricas de Latência',
            summary:
              'Comparação de latência p95 com gráfico comparativo de carga.',
            mainTopics: ['Redução de p95 em 60%'],
            visualElements: [
              {
                id: 'vis_1',
                type: 'grafico',
                title: 'Gráfico de Latência',
                description: 'Comparativo p95.',
                sectionId: 'sec_2',
                sourcePages: [6],
              },
            ],
            sourcePages: [6],
          },
        ],
        mainArguments: [],
        keyConcepts: [],
        authorExamples: [],
        conclusions: {
          explicitConclusions: [],
          aiInterpretations: [],
          sourcePages: [9],
        },
        relevantReferences: [],
        visualElements: [],
        aiInterpretations: [],
        uncertainties: [],
      },
    },
    contentDivision: [],
    sectionAssignments: {
      sec_1: 'mem_1',
      sec_2: 'mem_2',
    },
    slides: [],
    googlePresentation: {
      presentationId: 'pres_abc123',
      presentationUrl: 'https://docs.google.com/presentation/d/pres_abc123/edit',
      title: 'Arquitetura Distribuída — TeamDeck',
      slideCount: 6,
      approvedSectionIds: ['sec_1', 'sec_2'],
      generatedAt: '2026-11-12T10:00:00.000Z',
    },
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
  };

  const members: TeamMemberAssignmentView[] = [
    {
      associationId: 'pm_1',
      memberId: 'mem_1',
      projectId: 'proj_1',
      projectName: project.title,
      name: 'Ana Clara',
      email: 'ana.clara@usp.br',
      role: 'Líder técnica',
      responsibility: 'Fundamentação teórica e mensageria',
      presentationMinutes: 10,
      progress: 70,
      tasksCompleted: 3,
      tasksTotal: 4,
    },
    {
      associationId: 'pm_2',
      memberId: 'mem_2',
      projectId: 'proj_1',
      projectName: project.title,
      name: 'Bruno Santos',
      email: 'bruno.santos@usp.br',
      role: 'Pesquisador',
      responsibility: 'Métricas de desempenho e gráfico comparativo',
      presentationMinutes: 10,
      progress: 40,
      tasksCompleted: 2,
      tasksTotal: 4,
    },
  ];

  return { project, members };
}

test('buildPersonalizedMemberEmailDrafts gera mensagens com responsabilidade, tempo e links reais', () => {
  const { project, members } = createSampleProjectAndMembers();
  const drafts = buildPersonalizedMemberEmailDrafts({
    project,
    projectMembers: members,
    appBaseUrl: 'https://teamdeck.app',
  });

  assert.equal(drafts.length, 2);

  const anaDraft = drafts[0];
  assert.equal(anaDraft.recipientEmail, 'ana.clara@usp.br');
  assert.match(anaDraft.bodyText, /Olá, Ana Clara/);
  assert.match(anaDraft.bodyText, /Fundamentação e Filas/);
  assert.match(anaDraft.bodyText, /Tempo de apresentação previsto:/);
  assert.match(
    anaDraft.bodyText,
    /https:\/\/docs\.google\.com\/presentation\/d\/pres_abc123\/edit/
  );
  assert.match(
    anaDraft.bodyText,
    /https:\/\/teamdeck\.app\/\?project=proj_1&member=mem_1/
  );
});

test('encodeMimeEmailToBase64Url codifica assunto UTF-8 (RFC 2047), quebra corpo MIME em 76 chars (RFC 2045) e gera Base64URL válido', () => {
  const longBody = 'Linha acadêmica longa para testar wrapping RFC 2045. '.repeat(12);
  const encoded = encodeMimeEmailToBase64Url({
    fromEmail: 'equipe@usp.br',
    to: 'ana.clara@usp.br',
    subject: 'Apresentação Acadêmica — Revisão',
    bodyText: longBody,
  });

  assert.ok(!encoded.includes('+'));
  assert.ok(!encoded.includes('/'));
  assert.ok(!encoded.includes('='));

  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const decodedMime = Buffer.from(padded, 'base64').toString('utf8');
  assert.match(decodedMime, /From: equipe@usp\.br/);
  assert.match(decodedMime, /To: ana\.clara@usp\.br/);
  assert.match(decodedMime, /Subject: =\?UTF-8\?B\?/);
  assert.match(decodedMime, /Content-Type: text\/plain; charset="UTF-8"/);

  const [, mimeBody] = decodedMime.split('\r\n\r\n');
  const lines = (mimeBody ?? '').split('\r\n');
  assert.ok(lines.length > 1, 'Corpo Base64 longo deve ser quebrado em múltiplas linhas.');
  for (const line of lines) {
    assert.ok(line.length <= 76, `Linha MIME excedeu 76 caracteres: ${line.length}`);
  }
});

test('sendGmailMessage fluxo de sucesso confirma gmailMessageId retornado pela Gmail API', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  let capturedRaw = '';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    const headers = init?.headers as Record<string, string>;
    capturedAuth = headers.Authorization;
    const body = JSON.parse(String(init?.body)) as { raw: string };
    capturedRaw = body.raw;

    return new Response(
      JSON.stringify({ id: 'msg_gmail_999', threadId: 'thr_123' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const result = await sendGmailMessage({
      accessToken: 'ya29.valid_token_example_12345',
      fromEmail: 'lider@usp.br',
      recipientEmail: 'ana.clara@usp.br',
      subject: '[TeamDeck] Orientações da Apresentação',
      bodyText: 'Olá Ana, segue seu tempo e links do projeto.',
    });

    assert.equal(
      capturedUrl,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    );
    assert.equal(capturedAuth, 'Bearer ya29.valid_token_example_12345');
    assert.ok(capturedRaw.length > 20);
    assert.equal(result.gmailMessageId, 'msg_gmail_999');
    assert.equal(result.gmailThreadId, 'thr_123');
    assert.ok(result.sentAt.length > 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sendGmailMessage fluxos de falha: 401 expirado, 403 escopo, resposta sem id e erro de rede nunca simulam sucesso', async () => {
  const originalFetch = globalThis.fetch;

  // 1. Entrada inválida não chama API
  await assert.rejects(
    () =>
      sendGmailMessage({
        accessToken: 'ya29.valid_token_12345',
        recipientEmail: 'email-invalido',
        subject: 'Assunto válido',
        bodyText: 'Corpo suficientemente longo para validação.',
      }),
    (err: unknown) => {
      assert.ok(err instanceof GoogleWorkspaceApiError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'INVALID_EMAIL_INPUT');
      return true;
    }
  );

  // 2. Token expirado (401)
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ error: { code: 401, message: 'Invalid Credentials' } }),
      { status: 401 }
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        sendGmailMessage({
          accessToken: 'ya29.expired_token_12345',
          recipientEmail: 'ana@usp.br',
          subject: 'Assunto válido',
          bodyText: 'Corpo suficientemente longo para validação.',
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'GOOGLE_TOKEN_EXPIRED');
        return true;
      }
    );

    // 3. Permissão insuficiente (403)
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { code: 403, message: 'Insufficient Permission' } }),
        { status: 403 }
      )) as typeof fetch;

    await assert.rejects(
      () =>
        sendGmailMessage({
          accessToken: 'ya29.limited_token_12345',
          recipientEmail: 'ana@usp.br',
          subject: 'Assunto válido',
          bodyText: 'Corpo suficientemente longo para validação.',
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'GOOGLE_INSUFFICIENT_SCOPE');
        return true;
      }
    );

    // 4. Resposta 200 sem ID de mensagem não pode ser aceita como sucesso
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ threadId: 'only_thread' }), {
        status: 200,
      })) as typeof fetch;

    await assert.rejects(
      () =>
        sendGmailMessage({
          accessToken: 'ya29.token_12345',
          recipientEmail: 'ana@usp.br',
          subject: 'Assunto válido',
          bodyText: 'Corpo suficientemente longo para validação.',
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.code, 'MISSING_GMAIL_ID');
        return true;
      }
    );

    // 5. Falha de rede
    globalThis.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;

    await assert.rejects(
      () =>
        sendGmailMessage({
          accessToken: 'ya29.token_12345',
          recipientEmail: 'ana@usp.br',
          subject: 'Assunto válido',
          bodyText: 'Corpo suficientemente longo para validação.',
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateGmailMessageInput detecta campos faltantes ou incorretos', () => {
  const res = validateGmailMessageInput({
    recipientEmail: 'sem-arroba',
    subject: 'Oi',
    bodyText: 'Curto',
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.recipientEmail);
  assert.ok(res.errors.subject);
  assert.ok(res.errors.bodyText);
});

test('buildGoogleCalendarEventPayload e computeEventStartEnd montam evento completo com participantes, lembretes e Meet', () => {
  const { startDateTime, endDateTime } = computeEventStartEnd(
    '2026-11-23',
    '23:30',
    60
  );
  assert.equal(startDateTime, '2026-11-23T23:30:00');
  assert.equal(endDateTime, '2026-11-24T00:30:00');

  const input: CreateCalendarRehearsalInput = {
    projectId: 'proj_1',
    projectName: 'Arquitetura Distribuída',
    title: 'Ensaio Final Cronometrado',
    description: 'Passagem completa com slides.',
    date: '2026-11-22',
    time: '19:00',
    durationMinutes: 90,
    modality: 'Online',
    location: '',
    meetingLink: '',
    generateGoogleMeet: true,
    attendeeEmails: ['ANA.CLARA@usp.br', 'ana.clara@usp.br', 'bruno@usp.br'],
    reminders: [
      { method: 'popup', minutes: 30 },
      { method: 'email', minutes: 1440 },
    ],
    timeZone: 'America/Sao_Paulo',
  };

  const validation = validateCalendarRehearsalInput(input);
  assert.equal(validation.valid, true);

  const payload = buildGoogleCalendarEventPayload(input, 'req_meet_test');
  assert.equal(payload.summary, 'Ensaio Final Cronometrado');
  assert.equal(payload.start.dateTime, '2026-11-22T19:00:00');
  assert.equal(payload.end.dateTime, '2026-11-22T20:30:00');
  assert.deepEqual(payload.attendees, [
    { email: 'ana.clara@usp.br' },
    { email: 'bruno@usp.br' },
  ]);
  assert.equal(payload.reminders.useDefault, false);
  assert.equal(payload.reminders.overrides.length, 2);
  assert.equal(
    payload.conferenceData?.createRequest.conferenceSolutionKey.type,
    'hangoutsMeet'
  );
});

test('createGoogleCalendarRehearsal fluxo de sucesso salva eventId, htmlLink e googleMeetLink', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedMethod = '';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedMethod = init?.method || '';
    return new Response(
      JSON.stringify({
        id: 'evt_cal_777',
        htmlLink: 'https://www.google.com/calendar/event?eid=evt_cal_777',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const result = await createGoogleCalendarRehearsal({
      accessToken: 'ya29.calendar_token_12345',
      input: {
        projectId: 'proj_1',
        projectName: 'Arquitetura Distribuída',
        title: 'Ensaio Geral',
        description: 'Teste de tempo.',
        date: '2026-11-22',
        time: '18:00',
        durationMinutes: 60,
        modality: 'Online',
        location: '',
        meetingLink: '',
        generateGoogleMeet: true,
        attendeeEmails: ['ana@usp.br'],
        reminders: [{ method: 'popup', minutes: 15 }],
        timeZone: 'America/Sao_Paulo',
      },
    });

    assert.equal(capturedMethod, 'POST');
    assert.match(capturedUrl, /sendUpdates=all/);
    assert.match(capturedUrl, /conferenceDataVersion=1/);
    assert.equal(result.googleCalendarEventId, 'evt_cal_777');
    assert.equal(
      result.googleCalendarHtmlLink,
      'https://www.google.com/calendar/event?eid=evt_cal_777'
    );
    assert.equal(result.googleMeetLink, 'https://meet.google.com/abc-defg-hij');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createGoogleCalendarRehearsal fluxos de falha: erro de validação, 401, resposta sem id e falha de rede', async () => {
  const originalFetch = globalThis.fetch;

  const validInput: CreateCalendarRehearsalInput = {
    projectId: 'proj_1',
    projectName: 'Projeto Teste',
    title: 'Ensaio Presencial',
    description: 'Revisão.',
    date: '2026-11-22',
    time: '15:00',
    durationMinutes: 45,
    modality: 'Presencial',
    location: 'Sala 204',
    meetingLink: '',
    generateGoogleMeet: false,
    attendeeEmails: ['ana@usp.br'],
    reminders: [{ method: 'popup', minutes: 30 }],
    timeZone: 'America/Sao_Paulo',
  };

  // 1. Falha de validação (Presencial sem local)
  await assert.rejects(
    () =>
      createGoogleCalendarRehearsal({
        accessToken: 'ya29.valid_token_12345',
        input: { ...validInput, location: '' },
      }),
    (err: unknown) => {
      assert.ok(err instanceof GoogleWorkspaceApiError);
      assert.equal(err.code, 'INVALID_CALENDAR_INPUT');
      return true;
    }
  );

  // 2. HTTP 401 da Google Calendar API
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ error: { code: 401, message: 'Token expired' } }),
      { status: 401 }
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        createGoogleCalendarRehearsal({
          accessToken: 'ya29.expired_12345',
          input: validInput,
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'GOOGLE_TOKEN_EXPIRED');
        return true;
      }
    );

    // 3. Resposta 200 sem event id não simula criação
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ htmlLink: 'https://calendar.google.com' }), {
        status: 200,
      })) as typeof fetch;

    await assert.rejects(
      () =>
        createGoogleCalendarRehearsal({
          accessToken: 'ya29.valid_12345',
          input: validInput,
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.code, 'MISSING_EVENT_ID');
        return true;
      }
    );

    // 4. Erro de rede
    globalThis.fetch = (async () => {
      throw new Error('Network offline');
    }) as typeof fetch;

    await assert.rejects(
      () =>
        createGoogleCalendarRehearsal({
          accessToken: 'ya29.valid_12345',
          input: validInput,
        }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleWorkspaceApiError);
        assert.equal(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('googleTokenVault armazena cifrado no servidor, renova sessão, detecta expiração e revoga ao desconectar', async () => {
  _clearTokenVaultForTests();
  const originalFetch = globalThis.fetch;

  try {
    // 1. Sem cookie nem Bearer -> 401 GOOGLE_NOT_CONNECTED
    const emptyReq = { headers: {} } as Request;
    assert.throws(
      () => resolveGoogleAccessTokenFromRequest(emptyReq),
      (err: unknown) =>
        err instanceof GoogleTokenVaultError &&
        err.statusCode === 401 &&
        err.code === 'GOOGLE_NOT_CONNECTED'
    );

    // 1.1. Bearer header sem cookie NÃO é mais aceito
    const bearerOnlyReq = {
      headers: { authorization: 'Bearer ya29.secret_initial_token' },
    } as Request;
    assert.throws(
      () => resolveGoogleAccessTokenFromRequest(bearerOnlyReq),
      (err: unknown) =>
        err instanceof GoogleTokenVaultError &&
        err.statusCode === 401 &&
        err.code === 'GOOGLE_NOT_CONNECTED'
    );

    // 2. Armazena sessão com cifragem AES-256-GCM
    const stored = storeGoogleTokenSession({
      accessToken: 'ya29.secret_initial_token',
      email: 'ana@usp.br',
      displayName: 'Ana Clara',
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      expiresInSeconds: 3600,
    });

    assert.equal(stored.status.connected, true);
    assert.equal(stored.status.email, 'ana@usp.br');
    assert.equal(stored.status.isExpired, false);
    assert.ok(!JSON.stringify(stored.status).includes('ya29.secret_initial_token'));

    const cookieReq = {
      headers: {
        cookie: `${GOOGLE_SESSION_COOKIE_NAME}=${encodeURIComponent(
          stored.sessionId
        )}`,
      },
    } as Request;

    const status = getGoogleSessionStatusFromRequest(cookieReq);
    assert.equal(status.connected, true);
    assert.equal(status.email, 'ana@usp.br');

    const resolved = resolveGoogleAccessTokenFromRequest(cookieReq);
    assert.equal(resolved.accessToken, 'ya29.secret_initial_token');
    assert.equal(resolved.fromEmail, 'ana@usp.br');

    // 3. Renovação mantém o sessionId e atualiza o token
    const renewed = storeGoogleTokenSession({
      existingSessionId: stored.sessionId,
      accessToken: 'ya29.secret_renewed_token',
      email: 'ana@usp.br',
      displayName: 'Ana Clara',
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      expiresInSeconds: 3600,
    });
    assert.equal(renewed.sessionId, stored.sessionId);
    assert.equal(
      resolveGoogleAccessTokenFromRequest(cookieReq).accessToken,
      'ya29.secret_renewed_token'
    );

    // 4. Token expirado retorna 401 GOOGLE_TOKEN_EXPIRED
    storeGoogleTokenSession({
      existingSessionId: stored.sessionId,
      accessToken: 'ya29.expired_soon',
      email: 'ana@usp.br',
      scopes: [],
      expiresInSeconds: -10,
    });
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 2 * 60 * 60 * 1000;
    try {
      assert.equal(getGoogleSessionStatusFromRequest(cookieReq).isExpired, true);
      assert.throws(
        () => resolveGoogleAccessTokenFromRequest(cookieReq),
        (err: unknown) =>
          err instanceof GoogleTokenVaultError &&
          err.statusCode === 401 &&
          err.code === 'GOOGLE_TOKEN_EXPIRED'
      );
    } finally {
      Date.now = realDateNow;
    }

    // 5. Desconectar revoga token remoto (melhor esforço) e apaga sessão
    let revokedUrl = '';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      revokedUrl = String(input);
      return new Response('', { status: 200 });
    }) as typeof fetch;

    await revokeAndDeleteGoogleSession(cookieReq);
    assert.match(revokedUrl, /^https:\/\/oauth2\.googleapis\.com\/revoke\?token=/);
    assert.equal(getGoogleSessionStatusFromRequest(cookieReq).connected, false);
    assert.throws(
      () => resolveGoogleAccessTokenFromRequest(cookieReq),
      (err: unknown) =>
        err instanceof GoogleTokenVaultError &&
        err.code === 'GOOGLE_NOT_CONNECTED'
    );
  } finally {
    globalThis.fetch = originalFetch;
    _clearTokenVaultForTests();
  }
});

test('verifyGoogleAccessTokenWithGoogle valida identidade verificada via tokeninfo/userinfo e rejeita e-mail não verificado', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('tokeninfo')) {
        return new Response(
          JSON.stringify({
            email: 'Ana.Verified@usp.br',
            email_verified: 'true',
            scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/presentations',
            expires_in: '1800',
            sub: 'sub_123',
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ name: 'Ana Clara Verified' }),
        { status: 200 }
      );
    }) as typeof fetch;

    const verified = await verifyGoogleAccessTokenWithGoogle('ya29.real_valid_token_12345');
    assert.equal(verified.email, 'ana.verified@usp.br');
    assert.equal(verified.displayName, 'Ana Clara Verified');
    assert.equal(verified.expiresInSeconds, 1800);
    assert.deepEqual(verified.scopes, [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/presentations',
    ]);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          email: 'unverified@usp.br',
          email_verified: false,
        }),
        { status: 200 }
      )) as typeof fetch;

    await assert.rejects(
      () => verifyGoogleAccessTokenWithGoogle('ya29.unverified_token_12345'),
      (err: unknown) =>
        err instanceof GoogleTokenVaultError &&
        err.statusCode === 401 &&
        err.code === 'GOOGLE_EMAIL_UNVERIFIED'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
