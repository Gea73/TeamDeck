# TeamDeck

Plataforma web para organização de apresentações acadêmicas em grupo, com análise estruturada de documentos PDF via Gemini API, cálculo determinístico de tempo e distribuição de conteúdo, geração automática de slides no Google Slides, preparação individual dos apresentadores e agendamento de ensaios e comunicações via Google Calendar e Gmail.

## Funcionalidades

- **Projetos e Equipes**: criação, edição, exclusão e vinculação de integrantes com papéis, responsabilidades e metas de tempo.
- **Análise de PDF (Gemini API)**: envio de PDFs acadêmicos (até 20 MB) com extração estruturada em JSON (título, objetivo, introdução, seções, argumentos, conceitos, exemplos, elementos visuais e páginas de origem).
- **Distribuição de Conteúdo e Tempo**: cálculo determinístico (`130 palavras/min` + `10s` por elemento visual único), balanceamento automático preservando a ordem do documento e ajuste manual com recálculo em tempo real.
- **Google Slides**: geração de apresentação widescreen 16:9 editável com capa, slides balanceados, notas do apresentador e slide de conclusão.
- **Preparação Individual (Gemini API)**: roteiro oral exclusivo por integrante, explicação de conceitos, exemplos práticos, 5 perguntas da audiência com respostas fundamentadas e transições de slides, com edição e revisão por bloco.
- **Gmail e Google Calendar**: envio real de e-mails personalizados com links dos materiais e criação de ensaios no Google Calendar com participantes, lembretes e Google Meet.

## Configuração Local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env.local` (carregado automaticamente junto com `.env`):

   ```env
   GEMINI_API_KEY="sua-chave-gemini"
   GEMINI_MODEL="gemini-4-hydrogen"
   GOOGLE_TOKEN_VAULT_SECRET="segredo-aleatorio-com-pelo-menos-32-caracteres"
   APP_URL="http://localhost:3000"
   ```

3. Inicie o servidor de desenvolvimento (Express + Vite em `http://localhost:3000`):

   ```bash
   npm run dev
   ```

## Scripts Disponíveis

| Script | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor Express + Vite HMR/SPA na porta `3000` |
| `npm run build` | Gera o bundle de produção do frontend (`dist/`) e do servidor (`server.js`) |
| `npm start` | Executa o servidor de produção (`NODE_ENV=production node server.js`) |
| `npm run lint` | Verifica tipagem TypeScript em todo o projeto (`tsc --noEmit`) |
| `npm test` | Executa a suíte de testes unitários e de rotas HTTP (`tsx --test tests/*.test.ts`) |
| `npm run clean` | Remove os artefatos de build (`dist/` e `server.js`) |

## Segurança e Autenticação Google

- A autorização OAuth 2.0 solicita apenas os escopos necessários:
  - `https://www.googleapis.com/auth/presentations`
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/calendar.events`
- Ao conectar a conta Google, `POST /api/google/session` valida o token diretamente nos endpoints oficiais do Google (`tokeninfo` e `userinfo`), cifra o token com **AES-256-GCM** no servidor e define apenas um cookie `HttpOnly` (`SameSite=Lax`) no navegador.
- Nenhum access token permanece em cache no frontend ou é enviado em headers após a troca inicial de sessão.
- Endpoints de IA (`/pdf/analyze` e `/preparation/generate`) e integrações Google exigem sessão autenticada, validação de origem CSRF, limites de payload/taxa e validação estrutural com Zod.

## Persistência

A camada de acesso a dados (`src/repositories/teamDeckRepository.ts`) é isolada por interface (`ITeamDeckRepository`), preparada para migração futura para PostgreSQL sem alterar componentes ou regras de negócio.
