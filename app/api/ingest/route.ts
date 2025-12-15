import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { chunkText } from "@/lib/chunk";
import { embed } from "@/lib/rag";

export const runtime = "nodejs";

const Body = z.object({
  subject: z.literal("BM"),
  year: z.union([z.literal(3), z.literal(6)]),
  source: z.string().min(1),
  text: z.string().min(10),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const chunks = chunkText(body.text, 900);

  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await embed(content);
    const { error } = await supabaseAdmin.from("content_chunks").insert({
      subject: body.subject,
      year: body.year,
      source: body.source,
      chunk_index: i,
      content,
      embedding,
    });
    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted++;
  }

  return NextResponse.json({ inserted });
}
