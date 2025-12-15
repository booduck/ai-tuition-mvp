/**
 * Process Split PDFs
 *
 * Automatically processes all PDF files in split_bm_t3/ folder
 * by uploading them to the /api/ingest-file endpoint.
 *
 * Usage:
 *   npm run dev (in another terminal first!)
 *   npx tsx scripts/process-split-pdfs.ts [start-index] [end-index]
 *
 * Example:
 *   npx tsx scripts/process-split-pdfs.ts 1 5    # Process parts 1-5
 *   npx tsx scripts/process-split-pdfs.ts        # Process all parts
 */

import fs from 'fs';
import path from 'path';

const SPLIT_DIR = './split_bm_t3';
const API_URL = 'http://localhost:3000/api/ingest-file';
const SUBJECT = 'BM';
const YEAR = 3;
const DELAY_MS = 2000; // Wait 2s between uploads to avoid rate limits

async function uploadPDF(filePath: string, partNumber: number) {
  const fileName = path.basename(filePath);
  const formData = new FormData();

  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });

  formData.append('file', blob, fileName);
  formData.append('subject', SUBJECT);
  formData.append('year', YEAR.toString());
  formData.append('source', `Textbook Part ${partNumber}`);

  console.log(`\n📄 Processing: ${fileName}`);
  console.log(`   Size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`   ❌ Failed: ${error.error}`);
      return { success: false, error: error.error };
    }

    const result = await response.json();
    console.log(`   ✅ Success!`);
    console.log(`      Chunks inserted: ${result.inserted}/${result.totalChunks}`);
    console.log(`      Text extracted: ${result.extractedLength} chars`);
    if (result.fileUrl) {
      console.log(`      Stored at: ${result.fileUrl}`);
    }

    return { success: true, result };
  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: String(error) };
  }
}

async function main() {
  const startIndex = parseInt(process.argv[2] || '1');
  const endIndex = parseInt(process.argv[3] || '999');

  console.log('BM Tahun 3 Textbook Batch Processor');
  console.log('====================================\n');

  // Check if split directory exists
  if (!fs.existsSync(SPLIT_DIR)) {
    console.error(`❌ Directory not found: ${SPLIT_DIR}`);
    process.exit(1);
  }

  // Get all PDF files
  const files = fs.readdirSync(SPLIT_DIR)
    .filter(f => f.endsWith('.pdf') && f.startsWith('BM-Tahun3-part'))
    .sort((a, b) => {
      const aNum = parseInt(a.match(/part(\d+)/)?.[1] || '0');
      const bNum = parseInt(b.match(/part(\d+)/)?.[1] || '0');
      return aNum - bNum;
    });

  if (files.length === 0) {
    console.error('❌ No PDF files found in split_bm_t3/');
    process.exit(1);
  }

  // Filter by index range
  const filesToProcess = files.filter(f => {
    const partNum = parseInt(f.match(/part(\d+)/)?.[1] || '0');
    return partNum >= startIndex && partNum <= endIndex;
  });

  console.log(`Found ${files.length} PDF parts in ${SPLIT_DIR}`);
  console.log(`Processing ${filesToProcess.length} parts (${startIndex}-${endIndex})\n`);
  console.log('⚠️  Make sure your dev server is running: npm run dev\n');

  // Test API connectivity
  console.log('Testing API connection...');
  try {
    const testResponse = await fetch('http://localhost:3000/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', subject: 'BM', year: 3 })
    });
    if (!testResponse.ok && testResponse.status !== 400) {
      throw new Error('API not responding');
    }
    console.log('✅ API is ready\n');
  } catch (error) {
    console.error('❌ Cannot connect to API. Make sure to run: npm run dev');
    process.exit(1);
  }

  // Process files
  const results = {
    success: 0,
    failed: 0,
    totalChunks: 0,
    totalChars: 0,
  };

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    const partNum = parseInt(file.match(/part(\d+)/)?.[1] || '0');
    const filePath = path.join(SPLIT_DIR, file);

    const result = await uploadPDF(filePath, partNum);

    if (result.success && result.result) {
      results.success++;
      results.totalChunks += result.result.inserted || 0;
      results.totalChars += result.result.extractedLength || 0;
    } else {
      results.failed++;
    }

    // Wait between requests to avoid rate limits
    if (i < filesToProcess.length - 1) {
      console.log(`   ⏳ Waiting ${DELAY_MS / 1000}s before next upload...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Summary
  console.log('\n\n📊 Processing Complete!');
  console.log('========================');
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📦 Total chunks: ${results.totalChunks}`);
  console.log(`📝 Total text: ${results.totalChars.toLocaleString()} characters`);
  console.log(`\n💰 Estimated cost: $${((results.totalChars / 1000000) * 0.13).toFixed(2)} (embeddings only)`);
  console.log(`\nNext: Test the tutor at http://localhost:3000/kid`);
}

main().catch(console.error);
