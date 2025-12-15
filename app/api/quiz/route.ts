import { NextResponse } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { retrieveRelevantChunks } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const Body = z.object({
  childId: z.string(),
  year: z.number().int(),
  subject: z.literal("BM"),
  topic: z.string().min(1),
  difficulty: z.enum(["easy","medium","hard"]).default("easy"),
  count: z.number().int().min(3).max(15).default(6),
  languageMode: z.enum(["BM_EN", "BM_ONLY", "EN_ONLY"]).default("BM_EN"),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());

  const chunks = await retrieveRelevantChunks({
    subject: body.subject,
    year: body.year,
    query: body.topic,
    topK: 6,
  });

  const context = chunks.map((c,i)=>`[#${i+1} | ${c.source}]\n${c.content}`).join("\n\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      year: { type: "number" },
      passage: { type: ["string","null"] },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["mcq","short"] },
            question: { type: "string" },
            choices: { type: ["array","null"], items: { type: "string" } },
            answer: { type: "string" },
            explanation: { type: "string" },
            requiresPassage: { type: "boolean" }
          },
          required: ["id","type","question","answer","explanation"]
        }
      }
    },
    required: ["title","subject","year","items"]
  };

  const prompt = [
    "Bina kuiz BM sekolah rendah Malaysia yang PELBAGAI dan MENARIK.",
    "Gunakan konteks silibus/nota yang diberi. Pastikan soalan sesuai Tahun yang diminta.",
    "",
    "JENIS-JENIS SOALAN (campur semua jenis):",
    "",
    "1. SOALAN PEMAHAMAN (20-30% daripada kuiz)",
    "   - WAJIB buat 'passage' (petikan cerita) 80-120 patah perkataan",
    "   - Cerita mudah tentang kehidupan harian, kawan, keluarga, sekolah",
    "   - Set requiresPassage: true untuk SEMUA soalan yang rujuk petikan",
    "   - Soalan MESTI guna \"Berdasarkan petikan,\" atau \"Mengikut cerita di atas,\"",
    "   Contoh: \"Berdasarkan petikan, mengapakah Ali gembira?\"",
    "",
    "2. SOALAN TATABAHASA (30-40%)",
    "   - Set requiresPassage: false",
    "   - Kata nama, kata kerja, kata adjektif, kata sendi nama, ayat",
    "   - JANGAN guna perkataan \"petikan\" atau \"cerita\" dalam soalan",
    "   Contoh: \"Pilih kata adjektif yang betul: Baju itu sangat ___ (besar/tidur/makan)\"",
    "",
    "3. SOALAN SIMPULAN BAHASA & PERIBAHASA (20-30%)",
    "   - Set requiresPassage: false",
    "   - WAJIB guna petikan tunggal '...' pada frasa simpulan bahasa",
    "   - Boleh beri ayat contoh ringkas dalam soalan untuk konteks",
    "   Contoh: \"Apakah maksud 'buah tangan'?\"",
    "   Contoh dengan konteks: \"Dalam ayat 'Ali bawa buah tangan untuk nenek', 'buah tangan' bermaksud...\"",
    "",
    "4. SOALAN KOSA KATA (10-20%)",
    "   - Set requiresPassage: false",
    "   - Sinonim, antonim, makna perkataan",
    "   Contoh: \"Antonim bagi perkataan 'tinggi' ialah ___\"",
    "",
    "PANDUAN PENTING:",
    "- Campur 60% MCQ dan 40% jawapan pendek",
    "- JIKA ada soalan pemahaman, MESTI ada 'passage' yang tidak null/kosong",
    "- Hanya 2 soalan je pasal petikan (jangan lebih!)",
    "- Soalan lain (4 soalan) tentang tatabahasa, simpulan bahasa, kosa kata",
    "- Buat soalan yang sesuai dengan umur Tahun murid",
    "",
    `Topik: ${body.topic}`,
    `Kesukaran: ${body.difficulty}`,
    `Bilangan soalan: ${body.count}`,
    "",
    "PERATURAN KETAT:",
    "- Jika ada soalan dengan 'Berdasarkan petikan' → MESTI ada passage + requiresPassage:true",
    "- Jika tiada soalan pemahaman → boleh set passage:null + semua requiresPassage:false",
    "- JANGAN campur-campur - konsisten!",
    "",
    "Keluarkan dalam JSON yang sah mengikut skema.",
  ].join("\n");

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Anda ialah pembina kuiz BM yang teliti. Jangan hasilkan teks selain JSON." },
      { role: "user", content: `KONTEKS:\n${context}\n\nARAHAN:\n${prompt}\n\nSCHEMA(JSON):\n${JSON.stringify(schema)}` },
    ],
    response_format: { type: "json_object" },
  });

  // Best-effort JSON parse
  let quiz: any = null;
  const responseText = resp.choices[0]?.message?.content ?? "";
  try { quiz = JSON.parse(responseText); } catch { }

  if (!quiz) {
    return NextResponse.json({ error: "Quiz JSON parse failed", raw: responseText }, { status: 500 });
  }

  // VALIDATION: Check for passage consistency
  // If any question mentions "Berdasarkan petikan" or "Mengikut cerita",
  // there MUST be a passage and requiresPassage must be true
  const hasPassageKeywords = (question: string) => {
    const keywords = ["berdasarkan petikan", "mengikut cerita", "mengikut petikan", "daripada petikan"];
    const lowerQ = question.toLowerCase();
    return keywords.some(kw => lowerQ.includes(kw));
  };

  const questionsWithPassageKeywords = quiz.items?.filter((item: any) =>
    hasPassageKeywords(item.question || "")
  ) || [];

  if (questionsWithPassageKeywords.length > 0) {
    // There are questions that reference passage
    if (!quiz.passage || quiz.passage.trim().length === 0) {
      return NextResponse.json({
        error: "Quiz validation failed: Questions reference passage but no passage provided",
        details: "AI generated questions with 'Berdasarkan petikan' but passage is null/empty"
      }, { status: 500 });
    }

    // Check that all these questions have requiresPassage: true
    const missingFlag = questionsWithPassageKeywords.filter((item: any) =>
      item.requiresPassage !== true
    );

    if (missingFlag.length > 0) {
      return NextResponse.json({
        error: "Quiz validation failed: Questions reference passage but requiresPassage is not set to true",
        details: `${missingFlag.length} question(s) need requiresPassage: true`
      }, { status: 500 });
    }
  }

  // Save attempt placeholder (score later)
  const attempt = await supabaseAdmin.from("quiz_attempts").insert({
    child_id: body.childId,
    subject: body.subject,
    year: body.year,
    topic: body.topic,
    score: 0,
    total: quiz.items?.length ?? body.count,
    payload: quiz,
  }).select("id").single();

  return NextResponse.json({ quiz, attemptId: attempt.data?.id ?? null });
}
