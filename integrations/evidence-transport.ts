import { setTimeout as delay } from "node:timers/promises";
import { ClinicalError } from "../server/clinical/engine";

/** Render may return a non-JSON gateway page while a free service wakes up. */
export async function evidenceRequest(url: URL, key: string, payload: unknown, retryStartup = true) {
  const signal = AbortSignal.timeout(150000);
  const unavailable = () => new ClinicalError(503, "EVIDENCE_SERVICE_UNAVAILABLE", "The evidence service is starting or temporarily unavailable. Please try again shortly. No clinical answer was released.");
  for (let attempt = 0; attempt < (retryStartup ? 3 : 1); attempt++) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payload), signal });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch {
        if (![200, 502, 503, 504].includes(response.status)) throw unavailable();
      }
      // Never retry a structured model/policy error, or expose a gateway's HTML.
      if (result && typeof result === "object" && !Array.isArray(result)) return { response, result };
      if (![200, 502, 503, 504].includes(response.status)) throw unavailable();
    } catch (error) {
      if (error instanceof ClinicalError) throw error;
      if (signal.aborted) throw unavailable();
    }
    if (!retryStartup || attempt === 2) throw unavailable();
    try { await delay(2000, undefined, { signal }); } catch { throw unavailable(); }
  }
  throw unavailable();
}
