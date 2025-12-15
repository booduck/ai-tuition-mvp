"use client";

import { useMemo, useRef, useState, useEffect } from "react";

type ChildProfile = {
  id: string;
  displayName: string;
  year: 3 | 6;
  languageMode: "BM_EN" | "BM_ONLY" | "EN_ONLY";
};

type Topic = {
  key: string;
  label: string;
};

export default function VoiceTutor({ child, subject }: { child: ChildProfile; subject: "BM" }) {
  const [status, setStatus] = useState<"idle" | "recording" | "thinking" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [textInput, setTextInput] = useState("");
  const [lastError, setLastError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [canRecord, setCanRecord] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");

  const unlockAudio = () => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  useEffect(() => {
    // Avoid hydration mismatches: only decide recording capability on client
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices) {
      setCanRecord(true);
    }
    if (audioRef.current) {
      audioRef.current.setAttribute("playsinline", "true");
      audioRef.current.preload = "auto";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTopics() {
      setTopicsLoading(true);
      try {
        const res = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}&year=${child.year}`);
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setTopics(data.topics ?? []);
          setSelectedTopic("ALL");
        }
      } catch {
        // ignore – topic UI is best-effort
      } finally {
        if (!cancelled) setTopicsLoading(false);
      }
    }

    loadTopics();
    return () => {
      cancelled = true;
    };
  }, [child.year, subject]);

  const renderMarkdown = (text: string) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const html = escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br />");

    return { __html: `<p>${html}</p>` };
  };

  useEffect(() => {
    if (status === "idle") {
      setLastError("");
    }
  }, [status]);

  async function startRecording() {
    unlockAudio();
    setReply("");
    setTranscript("");
    setStatus("recording");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      setStatus("thinking");
      // 1) Transcribe
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      form.append("year", String(child.year));
      form.append("languageMode", child.languageMode);

      const trRes = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!trRes.ok) {
        setStatus("idle");
        setReply("Maaf, transkripsi gagal. Cuba lagi.");
        return;
      }
      const tr = await trRes.json();
      setTranscript(tr.text ?? "");

      // 2) Tutor
      const tutorRes = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          year: child.year,
          languageMode: child.languageMode,
          subject,
          message: tr.text ?? "",
          topicKey: selectedTopic === "ALL" ? undefined : selectedTopic,
        })
      });

      if (!tutorRes.ok) {
        setStatus("idle");
        setReply("Maaf, tutor ada masalah. Cuba lagi.");
        return;
      }

      const tutor = await tutorRes.json();
      setReply(tutor.reply ?? "");

      // 3) TTS
      setStatus("speaking");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: tutor.reply ?? "", voice: "alloy" })
      });
      if (ttsRes.ok) {
        const arrayBuf = await ttsRes.arrayBuffer();
        const audioBlob = new Blob([arrayBuf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play().catch(() => {});
          audioRef.current.onended = () => setStatus("idle");
        } else {
          setStatus("idle");
        }
      } else {
        setStatus("idle");
      }
    };

    mr.start();
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") mr.stop();
  }

  async function submitText() {
    if (!textInput.trim()) return;
    unlockAudio();
    setStatus("thinking");
    setTranscript(textInput.trim());
    setReply("");
    setLastError("");
    try {
      const tutorRes = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          year: child.year,
          languageMode: child.languageMode,
          subject,
          message: textInput.trim(),
          topicKey: selectedTopic === "ALL" ? undefined : selectedTopic,
        })
      });

      if (!tutorRes.ok) {
        setStatus("idle");
        setLastError("Maaf, tutor ada masalah. Cuba lagi.");
        return;
      }

      const tutor = await tutorRes.json();
      setReply(tutor.reply ?? "");

      // TTS
      setStatus("speaking");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: tutor.reply ?? "", voice: "alloy" })
      });
      if (ttsRes.ok) {
        const arrayBuf = await ttsRes.arrayBuffer();
        const audioBlob = new Blob([arrayBuf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play().catch(() => {});
          audioRef.current.onended = () => setStatus("idle");
        } else {
          setStatus("idle");
        }
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
      setLastError("Maaf, tutor ada masalah. Cuba lagi.");
    }
  }

  return (
    <div className="modern-voice-session">
      <div className="voice-layout">
        <section className="voice-hero" aria-label="Voice controls">
          {/* AI Avatar with Glass Morphism */}
          <div className="ai-avatar-modern">
            <div className={`avatar-orb ${status}`} data-state={status} aria-label={`AI avatar ${status}`}>
              <div className="buddy-ambient" />
              <div className="buddy-scene" aria-hidden="true">
                <div className="buddy-cube">
                  <div className="cube-face front">
                    <div className="buddy-face">
                      <div className="buddy-eyes">
                        <span className="eye"><span className="pupil" /></span>
                        <span className="eye"><span className="pupil" /></span>
                      </div>
                      <div className="buddy-mouth" />
                    </div>
                  </div>
                  <div className="cube-face back" />
                  <div className="cube-face right" />
                  <div className="cube-face left" />
                  <div className="cube-face top" />
                  <div className="cube-face bottom" />
                </div>
              </div>
              <div className="particle-ring">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="particle" style={{ "--i": i } as any}></div>
                ))}
              </div>
              <div className="buddy-halo" />
              <div className="sound-visualizer" aria-hidden={status !== "speaking"}>
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="bar" style={{ "--i": i } as any}></div>
                ))}
              </div>
              <div className="glow-effect" />
            </div>
            <div className="status-text">
              {status === "idle" && (
                <span className="status-badge idle">
                  <span className="pulse-dot"></span>
                  Sedia!
                </span>
              )}
              {status === "recording" && (
                <span className="status-badge recording">
                  <span className="pulse-dot"></span>
                  Saya dengar…
                </span>
              )}
              {status === "thinking" && (
                <span className="status-badge thinking">
                  <span className="pulse-dot"></span>
                  Fikir sekejap…
                </span>
              )}
              {status === "speaking" && (
                <span className="status-badge speaking">
                  <span className="pulse-dot"></span>
                  Jawab sekarang
                </span>
              )}
            </div>
          </div>

          {/* Modern Control Panel */}
          <div className="control-panel">
            <button
              className={`voice-button ${status}`}
              disabled={!canRecord || status === "thinking" || status === "speaking"}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            >
              <div className="button-ripple"></div>
              <div className="button-content">
                {status === "recording" && (
                  <>
                    <div className="mic-icon recording">
                      <div className="mic-waves">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <span>Lepas untuk hantar</span>
                  </>
                )}
                {status === "thinking" && (
                  <>
                    <div className="loader-icon"></div>
                    <span>Sedang fikir…</span>
                  </>
                )}
                {status === "speaking" && (
                  <>
                    <div className="speaker-icon">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>Mainkan jawapan…</span>
                  </>
                )}
                {status === "idle" && (
                  <>
                    <div className="mic-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line>
                        <line x1="8" y1="23" x2="16" y2="23"></line>
                      </svg>
                    </div>
                    <span>Tekan & tahan untuk cakap</span>
                  </>
                )}
              </div>
            </button>
          </div>

          <div className="voice-hints small">
            Tip: cakap pendek-pendek (1 ayat), senang tutor faham.
          </div>
        </section>

        <section className="voice-chat" aria-label="Conversation">
          <div className="chat-card">
            <div className="chat-title">
              <span className="kid-pill">Kamu</span>
              <span className="kid-pill">Tutor</span>
            </div>

            {topics.length > 0 && (
              <div className="topic-pill-row">
                <button
                  type="button"
                  className={`topic-pill ${selectedTopic === "ALL" ? "selected" : ""}`}
                  onClick={() => setSelectedTopic("ALL")}
                  disabled={topicsLoading}
                >
                  Semua topik
                </button>
                {topics.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`topic-pill ${selectedTopic === t.key ? "selected" : ""}`}
                    onClick={() => setSelectedTopic(t.key)}
                    disabled={topicsLoading}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-bubbles" role="log" aria-live="polite">
              {!transcript && !reply && !lastError && (
                <div className="chat-empty">
                  <div className="small" style={{ color: "rgba(255,255,255,0.85)" }}>
                    Cuba tanya: “Boleh ajar saya bina ayat?” atau “Apa itu kata nama?”
                  </div>
                </div>
              )}

              {transcript && (
                <div className="bubble bubble-kid">
                  <div className="bubble-label">Kamu</div>
                  <div
                    className="bubble-text markdown-text"
                    dangerouslySetInnerHTML={renderMarkdown(transcript)}
                  />
                </div>
              )}

              {reply && (
                <div className="bubble bubble-ai">
                  <div className="bubble-label">Tutor</div>
                  <div
                    className="bubble-text markdown-text"
                    dangerouslySetInnerHTML={renderMarkdown(reply)}
                  />
                </div>
              )}

              {lastError && (
                <div className="bubble bubble-error" role="alert">
                  <div className="bubble-label">Oops</div>
                  <div className="bubble-text">{lastError}</div>
                </div>
              )}
            </div>
          </div>

          <details className="voice-details" open>
            <summary>⌨️ Nak taip instead?</summary>
            <div className="voice-type-row">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Tulis soalan di sini…"
                disabled={status === "thinking" || status === "speaking"}
              />
              <button
                className="btn secondary"
                onClick={submitText}
                disabled={!textInput.trim() || status === "thinking" || status === "speaking"}
              >
                Hantar
              </button>
            </div>
          </details>

          <details className="voice-details">
            <summary>🔊 Playback (iPad: tap sekali dulu)</summary>
            <audio ref={audioRef} controls />
          </details>
        </section>
      </div>
    </div>
  );
}
