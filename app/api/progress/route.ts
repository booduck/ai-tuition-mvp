import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("quiz_attempts")
    .select("id, child_id, subject, score, total, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ attempts: data ?? [] });
}
