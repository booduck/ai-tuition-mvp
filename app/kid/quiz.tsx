"use client";

import { useState } from "react";

type ChildProfile = {
  id: string;
  displayName: string;
  year: 3 | 6;
  languageMode: "BM_EN" | "BM_ONLY" | "EN_ONLY";
};

type QuizItem = {
  id: string;
  type: "mcq" | "short";
  question: string;
  choices?: string[];
  answer: string;
  explanation: string;
  requiresPassage?: boolean;
};

type Quiz = {
  title: string;
  subject: string;
  year: number;
  passage?: string | null;
  items: QuizItem[];
};

type QuizResult = {
  id: string;
  type: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  feedback: string;
};

export default function QuizMode({ child, subject }: { child: ChildProfile; subject: "BM" }) {
  const [status, setStatus] = useState<"setup" | "loading" | "taking" | "grading" | "results">("setup");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [count, setCount] = useState(6);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [score, setScore] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [error, setError] = useState("");

  async function generateQuiz() {
    if (!topic.trim()) {
      setError("Sila masukkan topik!");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: child.id,
          year: child.year,
          subject,
          topic: topic.trim(),
          difficulty,
          count,
          languageMode: child.languageMode,
        })
      });

      if (!res.ok) {
        throw new Error("Quiz generation failed");
      }

      const data = await res.json();
      setQuiz(data.quiz);
      setAttemptId(data.attemptId);
      setAnswers({});
      setCurrentIndex(0);
      setStatus("taking");
    } catch (err) {
      setError("Maaf, gagal buat kuiz. Cuba lagi.");
      setStatus("setup");
    }
  }

  async function submitQuiz() {
    if (!attemptId || !quiz) return;

    setStatus("grading");
    setError("");

    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId,
          answers,
        })
      });

      if (!res.ok) {
        throw new Error("Grading failed");
      }

      const data = await res.json();
      setScore(data.score);
      setTotal(data.total);
      setResults(data.results);
      setStatus("results");
    } catch (err) {
      setError("Maaf, gagal markah kuiz. Cuba lagi.");
      setStatus("taking");
    }
  }

  function resetQuiz() {
    setStatus("setup");
    setQuiz(null);
    setAttemptId(null);
    setAnswers({});
    setCurrentIndex(0);
    setScore(null);
    setTotal(null);
    setResults([]);
    setError("");
  }

  const currentQuestion = quiz?.items[currentIndex];
  const isLastQuestion = currentIndex === (quiz?.items.length || 0) - 1;
  const canSubmit = quiz?.items.every(item => answers[item.id]?.trim());

  return (
    <div className="modern-voice-session">
      <div className="quiz-container">
        {/* Setup Mode */}
        {status === "setup" && (
          <div className="quiz-setup">
            <div className="quiz-header-glass">
              <h2 className="quiz-title">Kuiz BM</h2>
              <p className="quiz-subtitle">Bina kuiz berdasarkan topik yang kamu pilih</p>
            </div>

            <div className="quiz-form-card">
              <div className="form-group">
                <label>Topik Kuiz</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Kata Nama, Bina Ayat, dll"
                  className="quiz-input"
                />
              </div>

              <div className="quiz-settings-row">
                <div className="form-group">
                  <label>Kesukaran</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="quiz-select"
                  >
                    <option value="easy">Mudah</option>
                    <option value="medium">Sederhana</option>
                    <option value="hard">Sukar</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Bilangan Soalan</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="quiz-select"
                  >
                    {[3, 5, 6, 8, 10, 12, 15].map(n => (
                      <option key={n} value={n}>{n} soalan</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={generateQuiz} className="quiz-btn primary">
                🎯 Buat Kuiz
              </button>

              {error && <div className="quiz-error">{error}</div>}
            </div>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="quiz-loading">
            <div className="quiz-loader-orb">
              <div className="loader-spinner" />
            </div>
            <p>Sedang bina kuiz...</p>
          </div>
        )}

        {/* Taking Quiz */}
        {status === "taking" && quiz && currentQuestion && (
          <div className="quiz-taking">
            <div className="quiz-progress-bar">
              <div
                className="quiz-progress-fill"
                style={{ width: `${((currentIndex + 1) / quiz.items.length) * 100}%` }}
              />
            </div>

            {/* Passage Card - only shown for questions that require it */}
            {quiz.passage && currentQuestion.requiresPassage && (
              <div className="quiz-passage-card">
                <div className="passage-header">
                  <span className="passage-icon">📖</span>
                  <h3 className="passage-title">Petikan</h3>
                </div>
                <div className="passage-text">
                  {quiz.passage}
                </div>
              </div>
            )}

            <div className="quiz-question-card">
              <div className="quiz-question-header">
                <span className="quiz-q-number">Soalan {currentIndex + 1}/{quiz.items.length}</span>
                <span className={`quiz-type-badge ${currentQuestion.type}`}>
                  {currentQuestion.type === "mcq" ? "Pilihan Berganda" : "Jawapan Pendek"}
                </span>
              </div>

              <h3 className="quiz-question-text">{currentQuestion.question}</h3>

              {currentQuestion.type === "mcq" && currentQuestion.choices ? (
                <div className="quiz-choices">
                  {currentQuestion.choices.map((choice, i) => (
                    <button
                      key={i}
                      className={`quiz-choice ${answers[currentQuestion.id] === choice ? "selected" : ""}`}
                      onClick={() => setAnswers({ ...answers, [currentQuestion.id]: choice })}
                    >
                      <div className="choice-radio" />
                      <span className="choice-text">{choice}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  className="quiz-textarea"
                  value={answers[currentQuestion.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                  placeholder="Tulis jawapan kamu di sini..."
                  rows={4}
                />
              )}
            </div>

            <div className="quiz-nav-buttons">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="quiz-btn secondary"
              >
                ← Sebelum
              </button>

              {!isLastQuestion ? (
                <button
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="quiz-btn primary"
                >
                  Seterusnya →
                </button>
              ) : (
                <button
                  onClick={submitQuiz}
                  disabled={!canSubmit}
                  className="quiz-btn primary submit"
                >
                  ✓ Hantar Kuiz
                </button>
              )}
            </div>

            {error && <div className="quiz-error">{error}</div>}
          </div>
        )}

        {/* Grading */}
        {status === "grading" && (
          <div className="quiz-loading">
            <div className="quiz-loader-orb">
              <div className="loader-spinner" />
            </div>
            <p>Sedang markah kuiz...</p>
          </div>
        )}

        {/* Results */}
        {status === "results" && score !== null && total !== null && (
          <div className="quiz-results">
            <div className="quiz-score-card">
              <div className="score-orb">
                <div className="score-percentage">
                  {Math.round((score / total) * 100)}%
                </div>
                <div className="score-fraction">{score}/{total}</div>
              </div>

              <h2 className="score-title">
                {score === total ? "Sempurna! 🎉" : score >= total * 0.7 ? "Bagus! 👏" : "Cuba lagi! 💪"}
              </h2>
            </div>

            <div className="quiz-results-list">
              <h3>Semakan Jawapan</h3>
              {results.map((result, i) => (
                <div key={result.id} className={`result-item ${result.isCorrect ? "correct" : "wrong"}`}>
                  <div className="result-header">
                    <span className="result-number">Soalan {i + 1}</span>
                    <span className={`result-badge ${result.isCorrect ? "correct" : "wrong"}`}>
                      {result.isCorrect ? "✓ Betul" : "✗ Salah"}
                    </span>
                  </div>

                  <p className="result-question">{result.question}</p>

                  <div className="result-answers">
                    <div className="result-answer user">
                      <strong>Jawapan kamu:</strong> {result.userAnswer || "(Tiada jawapan)"}
                    </div>
                    {!result.isCorrect && (
                      <div className="result-answer correct">
                        <strong>Jawapan betul:</strong> {result.correctAnswer}
                      </div>
                    )}
                  </div>

                  {result.feedback && (
                    <div className="result-feedback">
                      <strong>Penerangan:</strong> {result.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={resetQuiz} className="quiz-btn primary">
              🔄 Buat Kuiz Baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
