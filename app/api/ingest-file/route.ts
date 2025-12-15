import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { chunkText } from "@/lib/chunk";
import { embed } from "@/lib/rag";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60; // For large files

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const subject = form.get("subject") as string || "BM";
    const year = Number(form.get("year")) || 3;
    const source = form.get("source") as string || "Uploaded File";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Supported: PDF, PNG, JPG, WEBP` },
        { status: 400 }
      );
    }

    // Check file size (max 10MB for free tier)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 10MB` },
        { status: 400 }
      );
    }

    let extractedText = "";
    let fileUrl = null;

    // Upload file to Supabase Storage first (optional - gracefully fail if bucket doesn't exist)
    const fileBuffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const fileName = `${subject}/${year}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    try {
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("syllabus-files")
        .upload(fileName, fileBuffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.warn("Storage upload skipped:", uploadError.message);
        // Continue without storage - bucket might not be created yet
      } else {
        // Get public URL (or signed URL for private bucket)
        const { data: urlData } = supabaseAdmin.storage
          .from("syllabus-files")
          .getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
    } catch (storageError) {
      console.warn("Storage not available, continuing without file URL");
      // Continue without storage
    }

    // Extract text based on file type
    if (file.type === "application/pdf") {
      // PDF parsing (FREE). pdf-parse export shape differs between CJS/ESM builds, so we shim it.
      const pdfParseMod = await import("pdf-parse");
      const pdfParse =
        (pdfParseMod as unknown as { default?: (input: Buffer) => Promise<{ text: string }> }).default ??
        (pdfParseMod as unknown as (input: Buffer) => Promise<{ text: string }>);
      const pdfBuffer = Buffer.from(fileBuffer);
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text;
      
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: "No text found in PDF. It might be scanned images or empty." },
          { status: 400 }
        );
      }
    } 
    else if (file.type.startsWith("image/")) {
      // Image OCR using OpenAI Vision API (COSTS MONEY ~$0.01-0.02 per image)
      const base64Image = Buffer.from(fileBuffer).toString("base64");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this image. Preserve formatting, structure, and any educational content. Output as plain text. If there are tables, convert them to readable format."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096
      });

      extractedText = response.choices[0]?.message?.content || "";
      
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: "No text extracted from image. It might be empty or unreadable." },
          { status: 400 }
        );
      }
    }

    // Chunk and embed the extracted text
    const chunks = chunkText(extractedText, 900);
    
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No content chunks created from extracted text" },
        { status: 400 }
      );
    }

    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      try {
        const embedding = await embed(content);
        const { error: insertError } = await supabaseAdmin.from("content_chunks").insert({
          subject,
          year,
          source: `${source} (${file.name})`,
          chunk_index: i,
          content,
          embedding,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type,
        });

        if (insertError) {
          console.error(`Insert error for chunk ${i}:`, insertError);
          errors.push(`Chunk ${i}: ${insertError.message}`);
        } else {
          inserted++;
        }
      } catch (err) {
        console.error(`Error processing chunk ${i}:`, err);
        errors.push(`Chunk ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    if (inserted === 0) {
      return NextResponse.json(
        { error: "Failed to insert chunks", errors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inserted,
      totalChunks: chunks.length,
      extractedLength: extractedText.length,
      fileUrl,
      fileName: file.name,
      warnings: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Ingest file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}

