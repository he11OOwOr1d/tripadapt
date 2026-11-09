"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiBaseUrl, getReadiness, type Readiness } from "../../lib/api";

export default function SystemPage() {
  const [result, setResult] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);

  async function check() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await getReadiness(controller.signal);
      if (active.current === controller) setResult(response);
    } catch (cause) {
      if (active.current === controller) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Connection timed out. Check that the API is running.");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) setLoading(false);
    }
  }

  useEffect(() => { void check(); return () => { active.current?.abort(); active.current = null; }; }, []);

  return (
    <main style={{ maxWidth: 760, margin: "80px auto", padding: 24, fontFamily: "system-ui", color: "#173d32" }}>
      <Link href="/">← TripAdapt</Link>
      <h1 style={{ fontSize: 40, marginTop: 32 }}>Project connections</h1>
      <p>This development page checks the browser → FastAPI → PostgreSQL connection.</p>
      <p>Frontend: <strong>running</strong></p>
      <div role="status" aria-live="polite">
        {loading && <p>Checking API and database…</p>}
        {error && <p style={{ color: "#a12626" }}>Connection check failed: {error}</p>}
        {result && <><p>API: <strong>connected</strong></p><p>PostgreSQL: <strong>connected</strong></p><p>Schema: <code>{result.data.schema_revision}</code></p><p>Database marker: <time>{result.data.initialized_at}</time></p><p>Request: <code>{result.meta.request_id}</code></p></>}
      </div>
      <button onClick={() => void check()} disabled={loading} style={{ padding: "12px 20px", marginTop: 16, cursor: "pointer" }}>Check again</button>
      <p style={{ marginTop: 32 }}>API endpoint: <code>{apiBaseUrl}/health/ready</code></p>
      <p>Trip storage, authentication, planning, providers, and background jobs are the next implementation stages.</p>
    </main>
  );
}
