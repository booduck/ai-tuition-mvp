export function chunkText(text: string, maxChars = 900): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  const paras = cleaned.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = "";

  for (const p of paras) {
    const part = p.trim();
    if (!part) continue;
    if ((buf + "\n\n" + part).length > maxChars) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = part;
    } else {
      buf = buf ? (buf + "\n\n" + part) : part;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
