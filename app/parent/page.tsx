"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Attempt = {
  id: string;
  child_id: string;
  subject: string;
  score: number;
  total: number;
  created_at: string;
};

export default function ParentPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    fetch("/api/progress")
      .then(r => r.json())
      .then(d => setAttempts(d.attempts ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <h1>Parent Mode</h1>
        <Link href="/" className="btn secondary">Home</Link>
      </div>

      <div className="card">
        <h2>Recent Quiz Attempts</h2>
        {attempts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p>No quiz attempts yet.</p>
            <p className="small mt-2">Quiz attempts will appear here once students start taking quizzes.</p>
          </div>
        ) : (
          <ul>
            {attempts.map(a => {
              const percentage = (a.score / a.total) * 100;
              const scoreColor = percentage === 100 ? "var(--success)" : percentage >= 70 ? "var(--warning)" : "var(--text-primary)";
              return (
                <li key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <strong style={{ color: "var(--text-primary)" }}>{a.child_id}</strong>
                      <span className="small" style={{ marginLeft: "8px", color: "var(--text-secondary)" }}>– {a.subject}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: "16px",
                        color: scoreColor,
                        padding: "4px 12px",
                        borderRadius: "6px",
                        background: percentage === 100 ? "#d1fae5" : percentage >= 70 ? "#fef3c7" : "#f3f4f6"
                      }}>
                        {a.score}/{a.total}
                      </span>
                      <span className="small" style={{ color: "var(--text-secondary)" }}>
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
