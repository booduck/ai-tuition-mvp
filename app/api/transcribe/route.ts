import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs"; // ensure Node runtime for OpenAI SDK

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const audio = await file.arrayBuffer();
  const blob = new Blob([audio], { type: file.type || "audio/webm" });

  // OpenAI SDK accepts File-like objects in Node; in Next.js runtime this works.
  const f = new File([blob], "audio.webm", { type: blob.type });

  const tr = await openai.audio.transcriptions.create({
    model: "gpt-4o-mini-transcribe",
    file: f,
  });

  return NextResponse.json({ text: tr.text });
}
