import { NextResponse } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const Body = z.object({
  attemptId: z.string(),
  answers: z.record(z.string()), // { questionId: answer }
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());

  // 1) Get quiz attempt
  const { data: attempt, error } = await supabaseAdmin
    .from("quiz_attempts")
    .select("*")
    .eq("id", body.attemptId)
    .single();

  if (error || !attempt) {
    return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 });
  }

  const quiz = attempt.payload as any;
  if (!quiz?.items) {
    return NextResponse.json({ error: "Invalid quiz data" }, { status: 400 });
  }

  // 2) Grade each question
  const results: Array<{
    id: string;
    type: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    feedback: string;
  }> = [];

  let correctCount = 0;

  for (const item of quiz.items) {
    const userAnswer = body.answers[item.id] || "";
    const correctAnswer = item.answer || "";
    let isCorrect = false;

    if (item.type === "mcq") {
      // MCQ: exact match (case-insensitive)
      isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    } else {
      // Short answer: use AI to grade with semantic understanding
      const gradingPrompt = `
Anda adalah pengelas kuiz BM yang adil dan fleksibel. Nilai jawapan murid berdasarkan makna dan pemahaman, bukan hanya perkataan yang sama.

Soalan: ${item.question}
Jawapan rujukan: ${correctAnswer}
Jawapan murid: ${userAnswer}

PANDUAN PENILAIAN:
- Terima jawapan jika makna dan konsep SAMA atau HAMPIR SAMA, walaupun perkataan berbeza
- Terima sinonim dan frasa alternatif (contoh: "menjaga hati" = "menggembirakan hati" = "membuat gembira")
- Terima jawapan yang lebih ringkas tetapi betul konsepnya
- Fokus pada pemahaman murid, bukan kata demi kata

Jawab "BETUL" jika:
- Jawapan murid menunjukkan pemahaman yang betul
- Maksud sama walaupun ayat berbeza
- Menggunakan sinonim atau ungkapan yang setara

Jawab "SALAH" hanya jika:
- Konsep atau makna salah sepenuhnya
- Jawapan tidak berkaitan dengan soalan
- Salah faham yang jelas

Format: BETUL/SALAH | feedback ringkas dalam BM
`;

      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Anda ialah pengelas kuiz BM yang bijak dan memahami pelbagai cara ungkapan. Terima jawapan berdasarkan makna, bukan ejaan tepat. Bersikap adil dan fleksibel." },
            { role: "user", content: gradingPrompt }
          ],
          temperature: 0.3, // Lower temperature for more consistent grading
        });

        const output = resp.choices[0]?.message?.content?.trim() || "";
        isCorrect = output.toUpperCase().startsWith("BETUL");
      } catch {
        // If AI grading fails, mark as incorrect
        isCorrect = false;
      }
    }

    if (isCorrect) correctCount++;

    results.push({
      id: item.id,
      type: item.type,
      question: item.question,
      userAnswer,
      correctAnswer,
      isCorrect,
      feedback: item.explanation || "",
    });
  }

  // 3) Update attempt with score
  const total = quiz.items.length;
  const score = correctCount;

  await supabaseAdmin
    .from("quiz_attempts")
    .update({ score, total })
    .eq("id", body.attemptId);

  return NextResponse.json({
    score,
    total,
    percentage: Math.round((score / total) * 100),
    results,
  });
}
