/**
 * Quick PDF Text Extraction Test
 *
 * Tests if a PDF has extractable text or if it's image-based (needs OCR)
 */

import fs from "node:fs";
import path from "node:path";

async function testPDF(filePath: string) {
  console.log(`\nTesting: ${path.basename(filePath)}`);
  console.log(`Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB`);

  try {
    const pdfParseMod = await import("pdf-parse");
    const pdfParse =
      (pdfParseMod as unknown as { default?: (input: Buffer) => Promise<{ text: string; numpages: number }> }).default ??
      (pdfParseMod as unknown as (input: Buffer) => Promise<{ text: string; numpages: number }>);
    const dataBuffer = fs.readFileSync(filePath);

    const data = await pdfParse(dataBuffer);

    console.log(`Pages: ${data.numpages}`);
    console.log(`Text length: ${data.text.length.toLocaleString()} characters`);

    if (data.text.length < 100) {
      console.log(`\n❌ IMAGE-BASED PDF`);
      console.log(`   This PDF contains scanned images, not text.`);
      console.log(`   You will need OCR (OpenAI Vision) to extract content.`);
      console.log(`   Est. cost: ${data.numpages} pages × $0.015 = $${(data.numpages * 0.015).toFixed(2)}`);
      return { hasText: false, pages: data.numpages, textLength: data.text.length };
    }

    console.log(`\n✅ TEXT-BASED PDF`);
    console.log(`   This PDF has extractable text!`);
    console.log(`   You can use the standard /api/ingest-file endpoint.`);
    console.log(`   Est. cost: $${((data.text.length / 1000000) * 0.13).toFixed(3)} (embeddings only)`);

    console.log(`\n--- Sample text (first 300 chars) ---`);
    console.log(data.text.substring(0, 300).trim());

    return { hasText: true, pages: data.numpages, textLength: data.text.length };
  } catch (error) {
    console.error(`\n❌ Error reading PDF:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  const testFile = process.argv[2] || './split_bm_t3/BM-Tahun3-part1.pdf';

  console.log('PDF Text Extraction Test');
  console.log('========================');

  if (!fs.existsSync(testFile)) {
    console.error(`File not found: ${testFile}`);
    console.log('\nUsage: npx tsx scripts/test-pdf-text.ts [pdf-path]');
    console.log('Example: npx tsx scripts/test-pdf-text.ts split_bm_t3/BM-Tahun3-part1.pdf');
    process.exit(1);
  }

  await testPDF(testFile);

  console.log('\n\nWant to test all split PDFs? Run:');
  console.log('  npx tsx scripts/test-all-pdfs.ts');
}

main();
