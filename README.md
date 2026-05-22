# VoxForge AI

VoxForge AI is a voice-enabled technical interview simulator built with Next.js, Supabase, Groq, Deepgram, Murf AI, and Monaco Editor. It generates interview questions, conducts spoken interview turns, stores interview state, and produces structured performance feedback.

## System Overview

| Layer | Core Responsibility | Main Technologies |
| --- | --- | --- |
| Frontend | Interview setup, dashboard, feedback history, voice UI, code editor | Next.js App Router, React 19, TypeScript, Tailwind CSS, Framer Motion |
| API Layer | Session orchestration, question generation, STT, LLM inference, TTS, feedback generation | Next.js Route Handlers |
| Auth + Database | User auth, session persistence, question tracking, feedback reports, statistics view | Supabase Auth, Supabase Postgres |
| AI Inference | Question generation, interviewer responses, evaluation, feedback scoring | Groq Chat Completions |
| Speech Pipeline | Candidate audio transcription and AI voice synthesis | Deepgram STT, Murf AI TTS |
| Coding UX | In-browser coding interface for technical questions | Monaco Editor |

## Core Features

| Feature | Description | Important Files |
| --- | --- | --- |
| Multi-domain interviews | Supports DSA, Frontend, Backend, Fullstack, Cybersecurity, and DevOps interviews | `src/app/setup`, `src/app/api/sessions/route.ts` |
| Dynamic question generation | Generates interview questions from selected type, difficulty, topics, and count | `src/app/api/generate-question`, `src/app/api/generate-question-batch` |
| Voice-based interview turns | Accepts recorded audio, transcribes it, sends context to an LLM, and returns TTS audio | `src/app/api/process-turn/route.ts` |
| AI interviewer behavior | Uses prompt engineering to keep the assistant focused on the active question and follow-up count | `src/app/api/process-turn/route.ts` |
| Code-aware evaluation | Includes submitted code in the LLM context for coding interviews | `src/app/api/process-turn/route.ts`, `src/components/CodeEditor.tsx` |
| Feedback report generation | Produces overall score, verdict, category scores, strengths, improvements, and recommendations | `src/app/api/feedback/route.ts` |
| User dashboard | Displays interview history, scores, statistics, and recent feedback | `src/app/dashboard/page.tsx` |
| Persistent interview state | Stores sessions, questions, messages, status, and feedback in Supabase | `src/lib/supabase`, `src/lib/supabase/sql/init_schema.sql` |

## AI Pipeline

| Stage | Input | Model/API | Output | Current Mode |
| --- | --- | --- | --- | --- |
| Audio capture | Browser-recorded candidate audio | Frontend media APIs | Audio blob sent to API | Buffered upload |
| Speech-to-text | Audio buffer | Deepgram Nova-2 via `transcribeFile` | Candidate transcript | Prerecorded/batch STT |
| Context assembly | Transcript, messages, active question, code, follow-up state | Server-side prompt builder | Structured LLM prompt | Deterministic orchestration |
| Text generation | Interview prompt + conversation history | Groq chat completion | Interviewer reply + status tag | Non-streaming completion |
| Turn-state update | Transcript, reply, active question state | Supabase Postgres | Updated session/question rows | Route-level state mutation |
| Text-to-speech | Clean interviewer reply | Murf AI speech API | MP3 audio bytes encoded as base64 | Buffered TTS response |
| Feedback generation | Full conversation + question list | Groq chat completion | JSON feedback report | Non-streaming completion |

## Core ML / AI Terms

| Term | Meaning in This Project |
| --- | --- |
| LLM inference | Running a large language model to generate questions, interviewer replies, and feedback |
| Prompt engineering | Crafting instructions that control interview style, scoring, follow-ups, and status tags |
| Context window | The conversation history, active question, code, and metadata passed into the LLM |
| Conversational state | Stored messages and question status used to keep multi-turn interviews coherent |
| STT | Speech-to-text conversion from candidate audio into transcript text |
| TTS | Text-to-speech conversion from AI reply text into playable interview audio |
| Latency | Time spent across STT, LLM generation, TTS, database writes, and network calls |
| Token budget | The maximum amount of prompt and completion text the LLM can process per request |
| Temperature | LLM sampling parameter controlling response randomness and creativity |
| Structured output | Feedback route asks the LLM to return parseable JSON for scores and recommendations |
| Evaluation rubric | Prompt-defined scoring rules for technical skill, problem solving, and communication |
| Guardrails | Prompt constraints that keep the interviewer focused on the current question |
| Hallucination control | Restricting the model to the active question and existing interview context |
| Follow-up policy | Difficulty-based limit that controls how many clarifying questions the AI asks |
| Batch transcription | Audio is uploaded and transcribed after recording, not streamed live token-by-token |
| Buffered synthesis | TTS audio is generated fully before being returned to the frontend |

## External Services

| Service | Purpose | Required Env Var | Where Used |
| --- | --- | --- | --- |
| Supabase | Auth, Postgres database, sessions, questions, feedback, statistics | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/*`, dashboard and API routes |
| Groq | LLM inference for generation and feedback | `GROQ_API_KEY` | `src/app/api/generate-*`, `src/app/api/process-turn`, `src/app/api/feedback` |
| Deepgram | Speech-to-text transcription | `DEEPGRAM_API_KEY` | `src/app/api/process-turn/route.ts` |
| Murf AI | Text-to-speech voice generation | `MURF_API_KEY` | `src/app/api/generate-intro`, `src/app/api/process-turn` |
| Google OAuth | Optional social sign-in through Supabase provider | Supabase provider config | `src/app/login`, `src/app/signup` |

## Database Schema

Run the Supabase schema file before using the app:

```bash
src/lib/supabase/sql/init_schema.sql
```

| Object | Type | Purpose |
| --- | --- | --- |
| `user_profiles` | Table | Stores user display name, avatar, and aggregate profile fields |
| `interview_sessions` | Table | Stores interview type, difficulty, topics, voice, messages, status, and progress |
| `interview_questions` | Table | Stores generated questions, status, order, follow-up count, answers, and completion state |
| `feedback_reports` | Table | Stores final scores, verdicts, category feedback, recommendations, and raw JSON feedback |
| `user_statistics` | View | Computes dashboard statistics from sessions, questions, profiles, and feedback |

| Database Feature | Why It Exists |
| --- | --- |
| Enums | Restrict interview types, difficulty levels, session states, question states, and verdicts |
| Foreign keys | Link sessions, questions, feedback, and profiles to authenticated users |
| Indexes | Optimize dashboard queries, session lookups, question ordering, and feedback history |
| Triggers | Keep `updated_at`, `question_count`, `user_id`, and completion fields in sync |
| RLS disabled | Tables are intentionally unrestricted in the included SQL script |

> Important: The included SQL disables row-level security and grants broad access because this project is configured for unrestricted tables. Do not use that security model for production without adding proper RLS policies.

## API Routes

| Route | Method | Responsibility |
| --- | --- | --- |
| `/api/sessions` | `POST` | Create interview session and generate/store initial question batch |
| `/api/sessions` | `GET` | Fetch one authenticated user's session by ID |
| `/api/sessions` | `PATCH` | Update session messages, status, or current question index |
| `/api/sessions/[sessionId]` | `GET` | Fetch session details and reject completed/abandoned sessions |
| `/api/sessions/[sessionId]` | `PATCH` | Update session status |
| `/api/questions` | `GET` | Fetch session questions or active question |
| `/api/generate-question` | `POST` | Generate a single interview question |
| `/api/generate-question-batch` | `POST` | Generate multiple questions upfront |
| `/api/generate-intro` | `POST` | Generate spoken intro for a question |
| `/api/process-turn` | `POST` | Run STT -> LLM -> TTS for one interview turn |
| `/api/feedback` | `POST` | Generate and store final feedback |
| `/api/feedback` | `GET` | Fetch feedback report(s) |
| `/api/sessions/[sessionId]/feedback` | `GET` | Fetch feedback for a completed session |
| `/api/cleanup-interviews` | `POST` | Mark stale active interviews as abandoned |

## Runtime Characteristics

| Capability | Current Implementation |
| --- | --- |
| WebSockets | Not used |
| Live STT streaming | Not used; Deepgram prerecorded transcription is used |
| LLM token streaming | Not used; Groq completions return full responses |
| Progressive TTS playback | Not used; Murf audio is buffered then returned |
| Server-side API key protection | Yes; AI keys are only used from route handlers |
| Browser audio format | Recorded audio is uploaded to the server as form data |
| Audio response format | Base64 encoded MP3 returned in JSON |

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS, Framer Motion, Lucide React |
| Language | TypeScript |
| Database/Auth | Supabase |
| LLM SDK | `groq-sdk` |
| STT SDK | `@deepgram/sdk` |
| TTS API | Murf AI HTTP API |
| Code editor | `@monaco-editor/react` |
| Tooling | ESLint, npm |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real credentials.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Local or deployed app URL used by server-to-server calls |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon public key |
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `DEEPGRAM_API_KEY` | Yes | Deepgram API key for STT |
| `MURF_API_KEY` | Yes | Murf AI API key for TTS |

## Local Setup

| Step | Command / Action |
| --- | --- |
| Install dependencies | `npm install` |
| Create env file | `cp .env.example .env.local` |
| Fill credentials | Add Supabase, Groq, Deepgram, and Murf keys to `.env.local` |
| Create database schema | Run `src/lib/supabase/sql/init_schema.sql` in Supabase SQL Editor |
| Start development server | `npm run dev` |
| Open app | `http://localhost:3000` |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server after build |
| `npm run lint` | Run ESLint |

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/app` | Next.js pages, layouts, and API route handlers |
| `src/app/api` | Backend orchestration for AI, auth-aware sessions, questions, and feedback |
| `src/components` | Reusable UI components including code editor and voice interface |
| `src/lib/supabase` | Supabase clients, database types, and SQL schema |
| `src/lib/types.ts` | Shared TypeScript types for messages and questions |
| `src/lib/utils.ts` | Shared utility helpers |
| `.env.example` | Public template for required environment variables |
| `package.json` | Scripts and dependencies |

## Interview Domains

| Domain | Example Coverage |
| --- | --- |
| DSA | Arrays, strings, graphs, dynamic programming, time and space complexity |
| Frontend | React, state management, rendering, browser APIs, accessibility |
| Backend | APIs, databases, caching, queues, authentication, scaling |
| Fullstack | End-to-end system design, client-server contracts, data flow |
| Cybersecurity | OWASP, secure auth, threat modeling, input validation |
| DevOps | CI/CD, containers, deployment, monitoring, reliability |

## Notes

| Topic | Current Status |
| --- | --- |
| Production security | RLS is disabled in the provided SQL; add Supabase RLS policies before production |
| Streaming roadmap | True WebSocket/live STT/token streaming/progressive TTS can be added later |
| API key safety | Keep `.env.local` private; only `.env.example` should be committed |
| Schema source of truth | Use `src/lib/supabase/sql/init_schema.sql` as the database bootstrap file |
