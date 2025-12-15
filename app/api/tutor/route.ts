import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveRelevantChunks } from "@/lib/rag";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const Body = z.object({
  childId: z.string(),
  year: z.number().int(),
  subject: z.string(),
  languageMode: z.enum(["BM_EN", "BM_ONLY", "EN_ONLY"]),
  message: z.string().min(1),
  topicKey: z.string().optional(),
});

function buildSystemPrompt(params: { year: number; languageMode: "BM_EN"|"BM_ONLY"|"EN_ONLY"; topicKey?: string }) {
  const { year, languageMode, topicKey } = params;

  const langRule =
    languageMode === "BM_ONLY"
      ? "Jawab dalam Bahasa Melayu sahaja."
      : languageMode === "EN_ONLY"
      ? "Reply in English only."
      : "Utamakan Bahasa Melayu. Jika murid keliru, boleh jelaskan ringkas dalam English juga.";

  const levelRule =
    year <= 3
      ? "Guna ayat pendek, contoh mudah, dan tanya soalan kecil untuk pastikan faham."
      : "Guna penerangan lebih teratur. Tekankan kata kunci dan langkah menjawab.";

  const gradeRule = `Tahap murid: Tahun ${year} sekolah rendah (BUKAN Tingkatan). Jangan gunakan istilah \"Tingkatan\".`;

  const topicRule = topicKey
    ? `Fokuskan penerangan kepada topik "${topicKey}".`
    : "Jika tiada topik khusus dipilih, ikut konteks yang paling berkaitan.";

  return [
    "Anda ialah tutor sekolah rendah Malaysia untuk subjek Bahasa Melayu (BM).",
    gradeRule,
    "Ikut silibus dan nota yang diberikan (RAG context). Jangan mereka standard yang tiada dalam konteks.",
    langRule,
    levelRule,
    topicRule,
    "Gaya mengajar: tanya 2-4 soalan diagnosis bila perlu, kemudian ajar langkah demi langkah, beri latihan ringkas, dan rumuskan.",
    "Jangan beri jawapan akhir terus jika soalan latihan; beri hint dulu, kemudian semak jawapan murid.",
    "Jika konteks tidak cukup, tanya satu soalan jelas kepada murid/ibu bapa atau beri penerangan umum yang selamat dan nyatakan ia umum.",
  ].join("\n");
}

export async function POST(req: Request) {
  const json = await req.json();
  const body = Body.parse(json);

  // 1) Retrieve context from syllabus/notes
  const chunks = await retrieveRelevantChunks({
    subject: body.subject,
    year: body.year,
    query: body.message,
    topK: 6,
    topicKey: body.topicKey ?? null,
  });

  const context = chunks
    .map((c, i) => `[#${i+1} | ${c.source}]\n${c.content}`)
    .join("\n\n");

  // 2) Generate tutor reply
  const sys = buildSystemPrompt({ year: body.year, languageMode: body.languageMode, topicKey: body.topicKey });

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `KONTEKS (silibus/nota):\n${context}\n\nSOALAN/AYAT MURID:\n${body.message}` },
    ],
  });

  const reply = resp.choices[0]?.message?.content?.trim() ?? "Maaf, saya tak dapat jawab sekarang.";

  // 3) Save basic message log (optional)
  try {
    await supabaseAdmin.from("messages").insert({
      child_id: body.childId,
      subject: body.subject,
      year: body.year,
      role: "kid",
      content: body.message,
    });
    await supabaseAdmin.from("messages").insert({
      child_id: body.childId,
      subject: body.subject,
      year: body.year,
      role: "tutor",
      content: reply,
    });
  } catch (_) {
    // logging is best-effort; ignore failures
  }

  return NextResponse.json({ reply, sources: chunks.map(c => ({ source: c.source, similarity: c.similarity })) });
}
