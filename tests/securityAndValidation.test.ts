import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import { createApiApp } from '../server/app';
import { isRetryableHttpError } from '../server/config/gemini';
import { _clearTokenVaultForTests } from '../server/services/googleTokenVault';
import { isValidEmailAddress as isValidEmailFromGmail } from '../src/domain/gmailComposer';
import {
  computeEventStartEnd,
  MAX_CALENDAR_ATTENDEES,
  validateCalendarRehearsalInput,
} from '../src/domain/googleCalendarBuilder';
import {
  isRealIsoDate,
  isValidEmailAddress,
  isValidTime24h,
  isValidTimeZone,
  sanitizeExternalHttpUrl,
  validatePresentationDateInput,
  validateProjectInput,
} from '../src/domain/validators';
import { ProjectStatus } from '../src/types';

test('Validação rigorosa de datas, horários, e-mails, fuso horário e URLs externas', () => {
  // Datas impossíveis devem ser rejeitadas
  assert.equal(isRealIsoDate('2026-13-45'), false);
  assert.equal(isRealIsoDate('2026-02-31'), false);
  assert.equal(isRealIsoDate('2026-04-31'), false);
  assert.equal(isRealIsoDate('2025-02-29'), false);
  assert.equal(isRealIsoDate('2024-02-29'), true);
  assert.equal(isRealIsoDate('2026-11-24'), true);

  // Horários inválidos devem ser rejeitados
  assert.equal(isValidTime24h('99:99'), false);
  assert.equal(isValidTime24h('24:00'), false);
  assert.equal(isValidTime24h('12:60'), false);
  assert.equal(isValidTime24h('00:00'), true);
  assert.equal(isValidTime24h('23:59'), true);

  // Validators de projeto e apresentação rejeitam 2026-13-45 e 99:99
  const badProject = validateProjectInput({
    title: 'TCC Sistemas',
    description: 'Descrição acadêmica completa do trabalho.',
    discipline: 'Computação',
    advisor: 'Prof. Silva',
    presentationDate: '2026-13-45',
    presentationTime: '99:99',
    location: 'Auditório',
    targetDurationMinutes: 20,
    status: ProjectStatus.IN_PROGRESS,
  });
  assert.equal(badProject.valid, false);
  assert.ok(badProject.errors.presentationDate);
  assert.ok(badProject.errors.presentationTime);

  const badPresDate = validatePresentationDateInput('2026-02-31', '99:99', 'Sala 1');
  assert.equal(badPresDate.valid, false);
  assert.ok(badPresDate.errors.presentationDate);
  assert.ok(badPresDate.errors.presentationTime);

  // computeEventStartEnd lança erro em datas/horários inválidos
  assert.throws(() => computeEventStartEnd('2026-02-31', '19:00', 60));
  assert.throws(() => computeEventStartEnd('2026-11-24', '99:99', 60));

  // E-mail compartilhado rigoroso
  for (const invalidEmail of [
    'a@b..c',
    'a@-b.c',
    'a@b.c>',
    '.a@b.com',
    'a.@b.com',
    'sem-arroba.com',
  ]) {
    assert.equal(isValidEmailAddress(invalidEmail), false, invalidEmail);
    assert.equal(isValidEmailFromGmail(invalidEmail), false, invalidEmail);
  }
  assert.equal(isValidEmailAddress('ana.clara+tcc@usp.br'), true);

  // Sanitização de URLs externas (bloqueia javascript:, data:, vbscript:)
  assert.equal(sanitizeExternalHttpUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeExternalHttpUrl('data:text/html,<script>'), undefined);
  assert.equal(
    sanitizeExternalHttpUrl('https://meet.google.com/abc-defg-hij'),
    'https://meet.google.com/abc-defg-hij'
  );

  // Fuso horário e limite de participantes no calendário
  assert.equal(isValidTimeZone('America/Sao_Paulo'), true);
  assert.equal(isValidTimeZone('Invalid/Timezone_XYZ'), false);

  const tooManyEmails = Array.from(
    { length: MAX_CALENDAR_ATTENDEES + 1 },
    (_, i) => `aluno${i}@usp.br`
  );
  const badCal = validateCalendarRehearsalInput({
    projectId: 'p1',
    projectName: 'Projeto',
    title: 'Ensaio Geral',
    description: '',
    date: '2026-11-24',
    time: '19:00',
    durationMinutes: 60,
    modality: 'Online',
    location: '',
    meetingLink: 'javascript:alert(1)',
    generateGoogleMeet: false,
    attendeeEmails: tooManyEmails,
    reminders: [],
    timeZone: 'Invalid/Timezone_XYZ',
  });
  assert.equal(badCal.valid, false);
  assert.ok(badCal.errors.meetingLink);
  assert.ok(badCal.errors.attendeeEmails);
  assert.ok(badCal.errors.timeZone);
});

test('isRetryableHttpError verifica status estruturado sem falsos positivos por substring', () => {
  assert.equal(isRetryableHttpError({ status: 500 }), true);
  assert.equal(isRetryableHttpError({ status: 429 }), true);
  assert.equal(isRetryableHttpError({ statusCode: 503 }), true);
  assert.equal(isRetryableHttpError({ code: 504 }), true);

  // Não deve dar retry só porque a mensagem contém "500" ou "429"
  assert.equal(
    isRetryableHttpError(new Error('Prompt limit exceeded: 1500 tokens max')),
    false
  );
  assert.equal(
    isRetryableHttpError(new Error('Document id 4290 not found')),
    false
  );
  assert.equal(isRetryableHttpError({ status: 400 }), false);
});

async function withTestServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApiApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('Rotas protegidas rejeitam chamadas sem sessão (401) e ignoram Bearer fallback direto', async () => {
  _clearTokenVaultForTests();

  await withTestServer(async (baseUrl) => {
    const protectedEndpoints = [
      { path: '/api/projects/p1/pdf/analyze', body: {} },
      { path: '/api/projects/p1/members/m1/preparation/generate', body: {} },
      { path: '/api/projects/p1/slides/generate', body: {} },
      { path: '/api/projects/p1/gmail/send', body: {} },
      { path: '/api/projects/p1/calendar/rehearsals', body: {} },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: baseUrl,
        },
        body: JSON.stringify(ep.body),
      });
      assert.equal(res.status, 401, `Esperado 401 em ${ep.path}`);
      const json = (await res.json()) as { code?: string };
      assert.equal(json.code, 'GOOGLE_NOT_CONNECTED');
    }

    // Enviar Authorization: Bearer direto para rota protegida continua bloqueado (401)
    const bearerRes = await fetch(`${baseUrl}/api/projects/p1/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer attacker_spoofed_token',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        recipientEmail: 'aluno@usp.br',
        subject: 'Teste',
        bodyText: 'Corpo suficientemente longo para teste.',
      }),
    });
    assert.equal(bearerRes.status, 401);
  });
});

test('POST /api/google/session valida token com Google tokeninfo, ignora e-mail forjado no body e emite cookie HttpOnly funcional', async () => {
  _clearTokenVaultForTests();
  const originalFetch = globalThis.fetch;

  try {
    await withTestServer(async (baseUrl) => {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith(baseUrl)) {
          return originalFetch(input, init);
        }
        if (url.includes('oauth2.googleapis.com/tokeninfo')) {
          return new Response(
            JSON.stringify({
              email: 'real.student@usp.br',
              email_verified: 'true',
              scope: 'https://www.googleapis.com/auth/gmail.send',
              expires_in: '3600',
            }),
            { status: 200 }
          );
        }
        if (url.includes('oauth2/v3/userinfo')) {
          return new Response(
            JSON.stringify({ name: 'Estudante Verificado' }),
            { status: 200 }
          );
        }
        if (url.includes('gmail.googleapis.com')) {
          return new Response(
            JSON.stringify({ id: 'gmail_ok_1', threadId: 'thr_1' }),
            { status: 200 }
          );
        }
        throw new Error(`Unexpected external fetch: ${url}`);
      }) as typeof fetch;

      // Body tenta forjar email do remetente, mas servidor deve usar o verificado pelo Google
      const sessionRes = await fetch(`${baseUrl}/api/google/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ya29.valid_google_token_12345',
          Origin: baseUrl,
        },
        body: JSON.stringify({
          email: 'spoofed@evil.com',
          displayName: 'Attacker',
        }),
      });

      assert.equal(sessionRes.status, 200);
      const sessionJson = (await sessionRes.json()) as {
        connected: boolean;
        email: string;
        displayName: string;
      };
      assert.equal(sessionJson.connected, true);
      assert.equal(sessionJson.email, 'real.student@usp.br');
      assert.equal(sessionJson.displayName, 'Estudante Verificado');

      const setCookie = sessionRes.headers.get('set-cookie') ?? '';
      assert.match(setCookie, /td_google_session=/);
      assert.match(setCookie, /HttpOnly/i);
      const cookiePair = setCookie.split(';')[0];

      // Envio autenticado via cookie HttpOnly funciona sem header Authorization
      const sendRes = await fetch(`${baseUrl}/api/projects/p1/gmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookiePair,
          Origin: baseUrl,
        },
        body: JSON.stringify({
          recipientEmail: 'colega@usp.br',
          subject: '[TeamDeck] Materiais da apresentação',
          bodyText: 'Olá! Seguem as instruções e links atualizados do grupo.',
        }),
      });
      assert.equal(sendRes.status, 200);
      const sendJson = (await sendRes.json()) as { gmailMessageId?: string };
      assert.equal(sendJson.gmailMessageId, 'gmail_ok_1');

      // Origem CSRF inválida retorna 403
      const csrfRes = await fetch(`${baseUrl}/api/projects/p1/gmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookiePair,
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({
          recipientEmail: 'colega@usp.br',
          subject: 'Teste CSRF',
          bodyText: 'Corpo suficientemente longo para teste.',
        }),
      });
      assert.equal(csrfRes.status, 403);
      const csrfJson = (await csrfRes.json()) as { code?: string };
      assert.equal(csrfJson.code, 'CSRF_ORIGIN_MISMATCH');

      // JSON malformado retorna 400 INVALID_JSON
      const malformedRes = await fetch(`${baseUrl}/api/projects/p1/gmail/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookiePair,
          Origin: baseUrl,
        },
        body: '{ invalid json',
      });
      assert.equal(malformedRes.status, 400);
      const malformedJson = (await malformedRes.json()) as { code?: string };
      assert.equal(malformedJson.code, 'INVALID_JSON');

      // Schema Zod em preparation/generate rejeita payload inválido (400)
      const badPrepRes = await fetch(
        `${baseUrl}/api/projects/p1/members/m1/preparation/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookiePair,
            Origin: baseUrl,
            'X-Forwarded-For': '198.51.100.10',
          },
          body: JSON.stringify({
            memberName: '',
            assignedSections: [],
          }),
        }
      );
      assert.equal(badPrepRes.status, 400);
      const badPrepJson = (await badPrepRes.json()) as { code?: string };
      assert.equal(badPrepJson.code, 'INVALID_PREPARATION_INPUT');

      // Rate limiter em rotas Gemini dispara 429 após exceder o limite (10 req/min por IP)
      let got429 = false;
      for (let i = 0; i < 12; i += 1) {
        const rlRes = await fetch(
          `${baseUrl}/api/projects/p1/members/m1/preparation/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookiePair,
              Origin: baseUrl,
              'X-Forwarded-For': '198.51.100.99',
            },
            body: JSON.stringify({ memberName: '', assignedSections: [] }),
          }
        );
        if (rlRes.status === 429) {
          got429 = true;
          const rlJson = (await rlRes.json()) as { code?: string };
          assert.equal(rlJson.code, 'GEMINI_RATE_LIMIT_EXCEEDED');
          break;
        }
      }
      assert.equal(got429, true, 'Rate limiter Gemini deveria retornar HTTP 429.');
    });
  } finally {
    globalThis.fetch = originalFetch;
    _clearTokenVaultForTests();
  }
});
