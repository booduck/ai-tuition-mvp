"use client";

import Link from "next/link";
import { useState, useRef } from "react";

export default function AdminPage() {
  const [year, setYear] = useState<3 | 6>(3);
  const [text, setText] = useState("");
  const [source, setSource] = useState("Buku Teks BM T3 (Part 1 p1-50)");
  const [status, setStatus] = useState("");
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      setStatus("error:File too large. Maximum size: 10MB");
      return;
    }
    setFile(selectedFile);
    setUploadMode("file");
    setStatus("");
  };

  async function ingest() {
    setStatus("loading");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: "BM", year, source, text })
      });
      if (!res.ok) {
        const error = await res.json();
        setStatus(`error:${error.error || "Unknown error"}`);
        return;
      }
      const out = await res.json();
      setStatus(`success:${out.inserted}`);
      setText("");
      setTimeout(() => setStatus(""), 5000);
    } catch (err) {
      setStatus(`error:${err instanceof Error ? err.message : "Network error"}`);
    }
  }

  async function ingestFile() {
    if (!file) return;
    
    setStatus("loading");
    const form = new FormData();
    form.append("file", file);
    form.append("subject", "BM");
    form.append("year", year.toString());
    form.append("source", source);

    try {
      const res = await fetch("/api/ingest-file", { 
        method: "POST", 
        body: form 
      });
      
      if (!res.ok) {
        const error = await res.json();
        setStatus(`error:${error.error || "Upload failed"}`);
        return;
      }
      
      const out = await res.json();
      setStatus(`success:${out.inserted}:${out.fileName || file.name}`);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => setStatus(""), 8000);
    } catch (err) {
      setStatus(`error:${err instanceof Error ? err.message : "Network error"}`);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      acceptFile(selectedFile);
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const pasted = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type || "image/png" });
        acceptFile(pasted);
        break;
      }
    }
  };

  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (status === "loading") return;
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      acceptFile(dt.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const getStatusMessage = () => {
    if (status === "loading") {
      return { type: "loading", text: "Processing..." };
    }
    if (status.startsWith("success:")) {
      const parts = status.split(":");
      return { 
        type: "success", 
        text: `✓ Successfully inserted ${parts[1]} chunks${parts[2] ? ` from ${parts[2]}` : ""}` 
      };
    }
    if (status.startsWith("error:")) {
      return { 
        type: "error", 
        text: `✗ ${status.split(":").slice(1).join(":")}` 
      };
    }
    return null;
  };

  const statusMsg = getStatusMessage();

  return (
    <div className="container">
      <div className="page-header">
        <h1>Admin – Ingest Content</h1>
        <Link href="/" className="btn secondary">Home</Link>
      </div>

      <div className="card">
        <div className="form-row">
          <div className="form-group">
            <label>Subject</label>
            <input value="BM" readOnly />
          </div>
          <div className="form-group">
            <label>Year</label>
            <select 
              value={year.toString()} 
              onChange={(e) => setYear(Number(e.target.value) as 3 | 6)}
              disabled={status === "loading"}
            >
              <option value="3">Tahun 3</option>
              <option value="6">Tahun 6</option>
            </select>
          </div>
          <div className="form-group">
            <label>Source label</label>
            <input 
              value={source} 
              onChange={(e) => setSource(e.target.value)} 
              placeholder="e.g., Buku Teks BM T3 (Part 2 p51-100)"
              disabled={status === "loading"}
            />
            <p className="small" style={{ marginTop: "4px", color: "var(--text-secondary)" }}>
              Tip: use descriptive, consistent labels so sources are traceable. Examples:
              {" "}<strong>Buku Teks BM T3 (Part 1 p1-50)</strong>,{" "}
              <strong>Buku Teks BM T3 (Latihan)</strong>,{" "}
              <strong>Nota Guru BM T3 (Tatabahasa)</strong>.
            </p>
          </div>
        </div>

        <div className="form-group">
          <label>Input Method</label>
          <select 
            value={uploadMode} 
            onChange={(e) => {
              setUploadMode(e.target.value as "text" | "file");
              setFile(null);
              setText("");
              setStatus("");
            }}
            disabled={status === "loading"}
          >
            <option value="text">📝 Paste Text</option>
            <option value="file">📄 Upload File (PDF/Image)</option>
          </select>
        </div>

        {uploadMode === "file" ? (
          <div className="form-group">
            <label>Upload PDF or Image</label>
            <div
              tabIndex={0}
              onPaste={handlePasteImage}
              onDrop={handleDropFiles}
              onDragOver={handleDragOver}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "12px",
                background: "var(--secondary)",
              }}
              aria-label="Paste screenshot or drop a file here"
              onClick={(e) => {
                // Ensure the div can receive paste events by focusing it
                (e.currentTarget as HTMLDivElement).focus();
              }}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                disabled={status === "loading"}
                style={{ marginBottom: "8px" }}
              />
              <div className="small" style={{ color: "var(--text-secondary)" }}>
                Tip: paste a screenshot (Cmd/Ctrl+V) or drop a file here. Max 10MB. Images use OCR (~$0.01-0.02 each).
              </div>
            </div>
            {file && (
              <div className="small" style={{ 
                padding: "8px 12px", 
                background: "var(--secondary)", 
                borderRadius: "8px",
                marginBottom: "12px"
              }}>
                📎 Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                {file.type.startsWith("image/") && (
                  <span style={{ display: "block", marginTop: "4px", color: "var(--warning)" }}>
                    ⚠️ Image OCR costs ~$0.01-0.02 per image
                  </span>
                )}
                <span style={{ display: "block", marginTop: "4px", color: "var(--text-secondary)" }}>
                  Tip: you can paste a screenshot directly here (Cmd/Ctrl+V) instead of saving a file.
                </span>
              </div>
            )}
            <div className="button-group">
              <button 
                className="btn" 
                onClick={ingestFile} 
                disabled={!file || status === "loading"}
              >
                {status === "loading" ? "Processing..." : "Upload & Ingest"}
              </button>
              {statusMsg && (
                <span className={`status-message ${statusMsg.type}`}>
                  {statusMsg.text}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Paste syllabus/notes text</label>
              <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder="Paste BM DSKP standards + your notes here..."
                disabled={status === "loading"}
              />
            </div>

            <div className="button-group">
              <button 
                className="btn" 
                onClick={ingest} 
                disabled={!text.trim() || status === "loading"}
              >
                {status === "loading" ? "Ingesting..." : "Ingest"}
              </button>
              {statusMsg && (
                <span className={`status-message ${statusMsg.type}`}>
                  {statusMsg.text}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: "24px", background: "rgba(255, 255, 255, 0.95)" }}>
        <h3 style={{ marginTop: 0, fontSize: "16px", fontWeight: 600 }}>💡 Tips</h3>
        <ul style={{ margin: 0, paddingLeft: "20px" }}>
          <li className="small" style={{ marginBottom: "8px" }}>
            <strong>PDF:</strong> Free to process. Works best with text-based PDFs.
          </li>
          <li className="small" style={{ marginBottom: "8px" }}>
            <strong>Images:</strong> Uses OCR (~$0.01-0.02 per image). Good for scanned documents.
          </li>
          <li className="small" style={{ marginBottom: "8px" }}>
            <strong>File Size:</strong> Maximum 10MB per file.
          </li>
          <li className="small">
            <strong>Storage:</strong> Files are stored in Supabase Storage (free tier: 1GB).
          </li>
        </ul>
      </div>
    </div>
  );
}
