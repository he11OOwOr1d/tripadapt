export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type Readiness = {
  data: { status: "ok"; api: "connected"; database: "connected"; schema_revision: string; initialized_at: string };
  meta: { request_id: string };
};

export async function getReadiness(signal: AbortSignal): Promise<Readiness> {
  const response = await fetch(`${apiBaseUrl}/health/ready`, { signal, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail ?? "The API could not complete the connection check.");
  return body;
}
