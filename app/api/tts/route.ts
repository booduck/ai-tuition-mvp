import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { text, voice } = await req.json();
  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: voice ?? "alloy",
    response_format: "mp3",
    input: text,
  });

  const buf = Buffer.from(await speech.arrayBuffer());
  return new Response(buf, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
