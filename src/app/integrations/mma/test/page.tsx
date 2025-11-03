'use client';

import { useEffect, useState } from 'react';

type Course = { id: string; title: string; description?: string };
type Quiz = { id: string; title: string; courseId?: string };

export default function MmaTestPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Soft-check that the theme css is reachable
        try {
          const cssRes = await fetch('/mma/theme.css', { cache: 'no-store' });
          setThemeLoaded(cssRes.ok);
        } catch {
          setThemeLoaded(false);
        }

        const [cRes, qRes] = await Promise.all([
          fetch('/integrations/mma/courses', { cache: 'no-store' }),
          fetch('/integrations/mma/quizzes', { cache: 'no-store' })
        ]);
        const [cData, qData] = await Promise.all([cRes.json(), qRes.json()]);
        if (!cancelled) {
          setCourses(cData?.courses || []);
          setQuizzes(qData?.quizzes || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function submitSample() {
    setLoading(true);
    setSubmitResult(null);
    setError(null);
    try {
      const idempotency = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
      const res = await fetch('/integrations/mma/quizzes/quiz-prompting/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': idempotency
        },
        body: JSON.stringify({ answers: [0, 2, 1] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Submit failed');
      setSubmitResult(data);
    } catch (e: any) {
      setError(e?.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-4">MMA Integration Test</h1>
      {themeLoaded === false && (
        <div className="mb-4 text-red-600">Theme CSS not loading from /mma/theme.css</div>
      )}
      {themeLoaded && (
        <div className="mb-4 text-green-700">Theme CSS loaded</div>
      )}
      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}

      <section className="mb-6">
        <h2 className="text-xl font-medium mb-2">Theme Preview</h2>
        {/* Begin MMA styled block */}
        <div className="mma-scope mma-bg" style={{ minHeight: '100vh', padding: '16px' }}>
          <div className="mma-logo" style={{ width: '160px', height: '48px', marginBottom: '12px' }} />
          <div className="mma-card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div className="mma-accent" style={{ fontSize: '12px', opacity: 0.8 }}>Quiz header</div>
            <div style={{ fontWeight: 700, fontSize: '20px', marginTop: '8px' }}>Introduction to Prompt Engineering</div>
            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '4px' }}>5 questions • 10 minutes</div>
          </div>
          <button className="mma-btn" style={{ margin: '12px 0' }}>Start Quiz</button>
          <div className="mma-card" style={{ padding: '16px', marginTop: '12px' }}>
            <label style={{ fontSize: '12px', opacity: 0.8 }}>Sample field</label>
            <input className="mma-input" placeholder="Your answer" />
          </div>
        </div>
        {/* End MMA styled block */}
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-medium mb-2">Courses</h2>
        <ul className="list-disc pl-6">
          {courses.map((c) => (
            <li key={c.id} className="mb-1">
              <div className="font-medium">{c.title}</div>
              {c.description && (
                <div className="text-sm text-gray-600">{c.description}</div>
              )}
            </li>
          ))}
          {courses.length === 0 && <li className="text-gray-600">No courses</li>}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-medium mb-2">Quizzes</h2>
        <ul className="list-disc pl-6">
          {quizzes.map((q) => (
            <li key={q.id} className="mb-1">
              <div className="font-medium">{q.title}</div>
              {q.courseId && (
                <div className="text-sm text-gray-600">Course: {q.courseId}</div>
              )}
            </li>
          ))}
          {quizzes.length === 0 && <li className="text-gray-600">No quizzes</li>}
        </ul>
      </section>

      <section className="mb-6">
        <button
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          onClick={submitSample}
          disabled={loading}
        >
          {loading ? 'Submitting…' : 'Submit sample quiz attempt (quiz-prompting)'}
        </button>
        {submitResult && (
          <pre className="mt-3 rounded bg-gray-100 p-3 text-sm overflow-auto">
{JSON.stringify(submitResult, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}


