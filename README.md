# Tuition with AI (PWA) – BM-first (Tahun 3 & Tahun 6) with Voice (Push-to-talk)

This starter kit gives you a working skeleton for:
- Next.js (TypeScript) PWA for iPad Safari
- Voice push-to-talk: record → transcribe → tutor → TTS playback
- Supabase Postgres + pgvector for syllabus/notes retrieval (RAG)
- Basic progress + quiz endpoints

## 0) Prereqs
- Node.js 18+ (or 20+)
- A Supabase project (recommended region: Singapore)
- An OpenAI API key

## 1) Create Supabase project and run schema
1. Create a new Supabase project.
2. Open **SQL Editor** and run: `supabase/schema.sql`

## 2) Environment variables
Copy `.env.example` to `.env.local` and fill:

- OPENAI_API_KEY=...
- SUPABASE_URL=...
- SUPABASE_SERVICE_ROLE_KEY=...  (server-side only, never expose to browser)

## 3) Install & run
```bash
npm install
npm run dev
```

Open: http://localhost:3000

## 4) Ingest BM syllabus/notes (DSKP + your own notes)
For the MVP, you can paste text into the admin ingest endpoint.

1. Go to: http://localhost:3000/admin
2. Paste BM content text (e.g., DSKP standards + your notes)
3. Choose Tahun 3 or Tahun 6
4. Click Ingest

## Notes
- This MVP is BM-first. You can add Math/English/Science later by:
  - ingesting subject-specific content (subject tag)
  - adding quiz templates per subject
  - extending the tutor prompt rules per subject.

## Deploy
- Deploy to Vercel (recommended).
- Add the same env vars in Vercel Project Settings.
