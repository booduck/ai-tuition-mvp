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
    "1. SOALAN PEMAHAMAN (30-40% daripada kuiz) - requiresPassage: true",
    "   - Buat 'passage' (petikan cerita/teks) 80-150 patah perkataan yang MUDAH dan menarik",
    "   - Cerita tentang kehidupan harian, kawan, keluarga, sekolah",
    "   - Soalan tentang pemahaman cerita:",
    "     * \"Berdasarkan petikan, mengapakah...\"",
    "     * \"Siapakah watak utama dalam cerita?\"",
    "     * \"Apakah pengajaran yang boleh kita dapat?\"",
    "",
    "2. SOALAN TATABAHASA (20-30%) - requiresPassage: false",
    "   - Kata nama, kata kerja, kata adjektif, kata sendi",
    "   - Ayat aktif/pasif, tunggal/jamak",
    "   - Ejaan dan tanda baca",
    "   Contoh: \"Pilih kata adjektif yang betul: Rumah itu sangat ___. (besar/berjalan/merah)\"",
    "",
    "3. SOALAN SIMPULAN BAHASA & PERIBAHASA (20-30%) - requiresPassage: false",
    "   - WAJIB guna petikan tunggal '...' pada frasa",
    "   - Boleh beri contoh ayat ringkas untuk konteks",
    "   Contoh: \"Apakah maksud 'mengambil hati'?\"",
    "   Contoh dengan ayat: \"'Buah tangan' bermaksud... (Ayat: Saya bawa buah tangan untuk nenek)\"",
    "",
    "4. SOALAN KOSA KATA (10-20%) - requiresPassage: false",
    "   - Sinonim, antonim, makna perkataan",
    "   - Bina ayat dengan perkataan tertentu",
    "   Contoh: \"Antonim bagi perkataan 'tinggi' ialah ___\"",
    "",
    "PANDUAN UMUM:",
    "- Campur 60% MCQ dan 40% jawapan pendek",
    "- Jika ada petikan, hanya 2-3 soalan je pasal petikan tu",
    "- Soalan lain tentang tatabahasa, simpulan bahasa, dll (tak perlu petikan)",
    "- Buat soalan yang sesuai dengan umur dan Tahun murid",
    "- Beri penerangan ringkas untuk setiap jawapan",
    "",
    `Topik: ${body.topic}`,
    `Kesukaran: ${body.difficulty}`,
    `Bilangan soalan: ${body.count}`,
    "",
    "Keluarkan dalam JSON yang sah mengikut skema yang diberi.",
    "INGAT: 'passage' boleh null jika tiada soalan pemahaman. Set requiresPassage:true untuk soalan yang perlu petikan.",
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
