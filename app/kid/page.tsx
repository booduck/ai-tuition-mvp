"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VoiceTutor from "./voice-tutor";
import QuizMode from "./quiz";

type ChildProfile = {
  id: string;
  displayName: string;
  year: 3 | 6;
  languageMode: "BM_EN" | "BM_ONLY" | "EN_ONLY";
};

const DEFAULT_PROFILES: ChildProfile[] = [
  { id: "t3", displayName: "Anak Tahun 3", year: 3, languageMode: "BM_EN" },
  { id: "t6", displayName: "Anak Tahun 6", year: 6, languageMode: "BM_EN" },
];

export default function KidPage() {
  const [profiles, setProfiles] = useState<ChildProfile[]>(DEFAULT_PROFILES);
  const [childId, setChildId] = useState(profiles[0].id);
  const [mode, setMode] = useState<"tutor" | "quiz">("tutor");

  const child = useMemo(() => profiles.find(p => p.id === childId)!, [profiles, childId]);

  return (
    <div className="container kid-page">
      <div className="page-header kid-header">
        <div>
          <h1 style={{ marginBottom: 6 }}>Tutor AI</h1>
          <div className="small" style={{ color: "rgba(255,255,255,0.92)" }}>
            Cakap atau taip — tutor akan bantu langkah demi langkah.
          </div>
        </div>
        <Link href="/" className="btn secondary">Home</Link>
      </div>

      <div className="kid-toolbar">
        <div className="form-row">
          <div className="form-group">
            <label>Profile</label>
            <select value={childId} onChange={(e) => setChildId(e.target.value)}>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.displayName} (Tahun {p.year})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Language</label>
            <select
              value={child.languageMode}
              onChange={(e) => setProfiles(ps => ps.map(p => p.id === childId ? { ...p, languageMode: e.target.value as "BM_EN" | "BM_ONLY" | "EN_ONLY" } : p))}
            >
              <option value="BM_EN">BM + English (Mixed)</option>
              <option value="BM_ONLY">BM only</option>
              <option value="EN_ONLY">English only</option>
            </select>
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input value="Bahasa Melayu (BM)" readOnly />
          </div>
        </div>

        <div className="kid-pill-row">
          <span className="kid-pill">Tahun {child.year}</span>
          <span className="kid-pill">BM Tutor</span>
          <span className="kid-pill">Hold mic to talk</span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle-row">
        <button
          className={`mode-toggle-btn ${mode === "tutor" ? "active" : ""}`}
          onClick={() => setMode("tutor")}
        >
          🎙️ Tutor Mode
        </button>
        <button
          className={`mode-toggle-btn ${mode === "quiz" ? "active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          🎯 Quiz Mode
        </button>
      </div>

      <div className="mt-2" />

      {mode === "tutor" ? (
        <VoiceTutor child={child} subject="BM" />
      ) : (
        <QuizMode child={child} subject="BM" />
      )}
    </div>
  );
}
