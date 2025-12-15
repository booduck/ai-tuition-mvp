import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container">
      <div className="homepage-header">
        <h1>Tuition with AI</h1>
        <p>
          iPad PWA + push-to-talk voice. Start with Bahasa Melayu (Tahun 3 & Tahun 6).
        </p>
      </div>

      <div className="mode-grid">
        <div className="mode-card">
          <h2>Kid Mode</h2>
          <p className="small">Choose profile, then talk to the tutor.</p>
          <Link className="btn" href="/kid">Open Kid Mode</Link>
        </div>

        <div className="mode-card">
          <h2>Parent Mode</h2>
          <p className="small">See basic progress & quiz history.</p>
          <Link className="btn secondary" href="/parent">Open Parent Mode</Link>
        </div>

        <div className="mode-card">
          <h2>Admin</h2>
          <p className="small">Paste DSKP/notes text and ingest into RAG store.</p>
          <Link className="btn secondary" href="/admin">Open Admin</Link>
        </div>
      </div>

      <div className="card text-center" style={{ background: "rgba(255, 255, 255, 0.95)", border: "2px solid rgba(255, 255, 255, 0.3)" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
          💡 <strong>Tip (iPad):</strong> voice playback usually needs a user tap first — press "Start Session" then talk.
        </p>
      </div>
    </div>
  );
}
