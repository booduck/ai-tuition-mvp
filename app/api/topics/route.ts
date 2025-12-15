import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function deriveTopicKeyAndLabel(source: string): { key: string; label: string } {
  const unitMatch = source.match(/Unit\s*\d+/i);
  if (unitMatch) {
    const unit = unitMatch[0].replace(/\s+/, " ").trim(); // "Unit 1"
    return { key: unit.toLowerCase(), label: unit };
  }

  const partMatch = source.match(/Part\s*\d+/i);
  if (partMatch) {
    const part = partMatch[0].replace(/\s+/, " ").trim(); // "Part 1"
    return { key: part.toLowerCase(), label: part };
  }

  const cleaned = source.replace(/\(pasted.*$/i, "").trim();
  return { key: cleaned.toLowerCase(), label: cleaned };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  const yearParam = url.searchParams.get("year");

  if (!subject || !yearParam) {
    return NextResponse.json({ error: "Missing subject or year" }, { status: 400 });
  }

  const year = Number(yearParam);
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("content_chunks")
      .select("source")
      .eq("subject", subject)
      .eq("year", year);

    if (error) {
      console.error("Error fetching topics:", error);
      return NextResponse.json({ error: "Failed to load topics" }, { status: 500 });
    }

    const buckets = new Map<string, { key: string; label: string }>();

    for (const row of data ?? []) {
      const src = row.source as string;
      if (!src) continue;
      const { key, label } = deriveTopicKeyAndLabel(src);
      if (!buckets.has(key)) {
        buckets.set(key, { key, label });
      }
    }

    const topics = Array.from(buckets.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "ms")
    );

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("Unexpected error fetching topics:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


