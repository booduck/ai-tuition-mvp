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
      // Short answer: use AI to grade
      const gradingPrompt = `
Soalan: ${item.question}
Jawapan betul: ${correctAnswer}
Jawapan murid: ${userAnswer}

Adakah jawapan murid betul atau hampir betul? Jawab "BETUL" atau "SALAH" dan beri feedback ringkas dalam BM.
Format: BETUL/SALAH | feedback
`;

      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Anda ialah pengelas kuiz BM yang adil." },
            { role: "user", content: gradingPrompt }
          ],
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
