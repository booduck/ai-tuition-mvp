import { openai } from "./openai";
import { supabaseAdmin } from "./supabaseAdmin";

export async function embed(text: string) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

export async function retrieveRelevantChunks(params: {
  subject: string;
  year: number;
  query: string;
  topK?: number;
  topicKey?: string | null;
}) {
  const { subject, year, query, topK = 6, topicKey } = params;
  const qEmbedding = await embed(query);

  // Calls SQL function match_content_chunks (see schema.sql)
  const { data, error } = await supabaseAdmin.rpc("match_content_chunks", {
    query_embedding: qEmbedding,
    match_count: topK,
    p_subject: subject,
    p_year: year,
  });

  if (error) throw error;
  let rows = (data ?? []) as Array<{ id: number; content: string; source: string; similarity: number }>;

  if (topicKey) {
    const keyLower = topicKey.toLowerCase();
    const filtered = rows.filter((r) => r.source.toLowerCase().includes(keyLower));
    if (filtered.length > 0) {
      rows = filtered;
    }
  }

  return rows.slice(0, topK);
}
