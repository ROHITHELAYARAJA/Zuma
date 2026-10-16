"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ShieldCheck,
  ShieldOff,
  Check,
  X,
  ArrowRight,
  Link2,
  Database,
  Unplug,
  Code2,
  AlertTriangle,
  Fingerprint,
  ExternalLink,
} from "lucide-react";
import type {
  AuditEvent,
  Bootstrap,
  RecordKind,
  ValidationResult,
  Workspace,
} from "../shared/types";
import { Badge, Busy, Empty, StatusIcon } from "./components";
import { api, date, post, time } from "./lib/api";
import PipelinePanel from "./PipelinePanel";

const EvidenceGraph = dynamic(() => import("../web/EvidenceGraph"), {
  ssr: false,
  loading: () => <Busy label="Opening the permitted evidence graph…" />,
});

const GRAPH_PALETTE = {
  background: "#111111",
  patient: "#FFD84D",
  hospital: "#FFFFFF",
  record: "#FF5B3E",
  edge: "#888888",
  text: "#FFFFFF",
};

export type Mutate = (
  path: string,
  body?: unknown,
  message?: string,
) => Promise<void>;
export function MatchingPage({
  w,
  mutate,
  busy,
}: {
  w: Workspace;
  mutate: Mutate;
  busy: boolean;
}) {
  return (
    <div className="admin-page">
      <header className="page-heading">
        <span className="large-icon">
          <Fingerprint size={25} />
        </span>
        <div>
          <h1>Patient matching</h1>
          <p>
            A shared name is not a shared identity. Review the evidence before
            linking records.
          </p>
        </div>
      </header>
      <section className="panel admin-panel">
        <div className="panel-heading">
          <h2>Current patient</h2>
          <Badge tone="blue">{w.patient.id}</Badge>
        </div>
        <div className="identity-grid">
          <div>
            <span className="label">Full name</span>
            <strong>{w.patient.name}</strong>
          </div>
          <div>
            <span className="label">Date of birth</span>
            <strong>{date(w.patient.birthDate)}</strong>
          </div>
          <div>
            <span className="label">Sex</span>
            <strong>{w.patient.sex}</strong>
          </div>
        </div>
      </section>
      <section className="panel admin-panel">
        <div className="panel-heading">
          <h2>Cross-hospital candidates</h2>
          <span className="muted">{w.candidates.length} candidates</span>
        </div>
        <div className="candidate-list">
          {w.candidates.map((candidate) => (
            <article key={candidate.id} className="candidate">
              <span className={`hospital-dot hospital-${candidate.hospitalId}`}>
                {candidate.hospitalId}
              </span>
              <div className="candidate-main">
                <h3>
                  {candidate.name}
                  <Badge
                    tone={
                      candidate.status === "confirmed"
                        ? "mint"
                        : candidate.status === "not-a-match"
                          ? "muted"
                          : "amber"
                    }
                  >
                    {candidate.status.replaceAll("-", " ")}
                  </Badge>
                </h3>
                <p>
                  MRN {candidate.localId} · DOB {date(candidate.birthDate)} ·
                  Phone ending {candidate.phoneLast4}
                </p>
                <ul>
                  {candidate.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="candidate-actions">
                <span className="match-score">
                  {Math.round(
                    candidate.matchScore > 1
                      ? candidate.matchScore
                      : candidate.matchScore * 100,
                  )}
                  %<small>Rule-based match score</small>
                </span>
                {candidate.status === "review-required" && (
                  <>
                    <button
                      className="button primary small"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/matches/${candidate.id}/confirm`,
                          {},
                          "Patient link updated.",
                        )
                      }
                    >
                      <Check size={14} />
                      Confirm link
                    </button>
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          `/matches/${candidate.id}/reject`,
                          {},
                          "Candidate marked as a different patient.",
                        )
                      }
                    >
                      <X size={14} />
                      Different patient
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="panel-footnote">
          Demonstration rules only. Production identity matching requires
          validated identifiers and an organizational review process.
        </p>
      </section>
    </div>
  );
}

export function ConsentPage({
  w,
  mutate,
  busy,
}: {
  w: Workspace;
  mutate: Mutate;
  busy: boolean;
}) {
  const active =
    w.consent.status === "active" && new Date(w.consent.expiresAt) > new Date();
  const [categories, setCategories] = useState<RecordKind[]>(
    w.consent.categories,
  );
  useEffect(
    () => setCategories(w.consent.categories),
    [w.consent.id, w.consent.version],
  );
  return (
    <div className="admin-page">
      <header className="page-heading">
        <span className="large-icon">
          <ShieldCheck size={25} />
        </span>
        <div>
          <h1>Consent center</h1>
          <p>
            Permissions apply before record retrieval, summaries, answers, and
            exports.
          </p>
        </div>
      </header>
      <section className="panel consent-panel">
        <div className="panel-heading">
          <h2>Access for {w.patient.name}</h2>
          <Badge tone={active ? "mint" : "coral"}>
            {active ? "Active permission" : "Access revoked or expired"}
          </Badge>
        </div>
        <div className="consent-flow">
          <div>
            <span className="hospital-dot hospital-A">A</span>
            <strong>
              {w.consent.sourceHospitals
                .map((id) => `Hospital ${id}`)
                .join(" + ")}
            </strong>
            <small>Permitted source hospitals</small>
          </div>
          <ArrowRight size={23} />
          <div>
            <ShieldCheck size={29} className="mint-text" />
            <strong>Purpose: treatment</strong>
            <small>Scoped, time-limited permission</small>
          </div>
          <ArrowRight size={23} />
          <div>
            <span className="hospital-dot hospital-B">B</span>
            <strong>{w.consent.recipient}</strong>
            <small>Authorized recipient</small>
          </div>
        </div>
        <div className="identity-grid">
          <div>
            <span className="label">Record categories</span>
            <strong>{w.consent.categories.join(", ")}</strong>
          </div>
          <div>
            <span className="label">Expires</span>
            <strong>
              {date(w.consent.expiresAt)} · {time(w.consent.expiresAt)}
            </strong>
          </div>
          <div>
            <span className="label">Policy version</span>
            <strong>Version {w.consent.version}</strong>
          </div>
        </div>
        <div className="consent-categories">
          <span className="label">
            Choose categories for this synthetic permission
          </span>
          <div>
            {(["lab", "allergy", "medication", "note"] as RecordKind[]).map(
              (kind) => (
                <label key={kind}>
                  <input
                    type="checkbox"
                    checked={categories.includes(kind)}
                    onChange={(e) =>
                      setCategories((previous) =>
                        e.target.checked
                          ? [...previous, kind]
                          : previous.filter((c) => c !== kind),
                      )
                    }
                  />
                  {kind === "lab"
                    ? "Lab results"
                    : kind === "allergy"
                      ? "Allergies"
                      : kind === "medication"
                        ? "Medicines"
                        : "Clinical notes"}
                </label>
              ),
            )}
          </div>
          <button
            className="button small"
            disabled={busy || !categories.length}
            onClick={() =>
              void mutate(
                `/consents/${w.consent.id}/grant`,
                { categories },
                "Synthetic permission categories updated. Evidence refreshed.",
              )
            }
          >
            Apply category permissions
          </button>
          <small>
            This grants a fresh 24-hour demonstration permission for the
            selected categories.
          </small>
        </div>
        <div className={`notice-strip ${active ? "mint" : "coral"}`}>
          <ShieldCheck size={18} />
          <p>{w.access.reason}</p>
        </div>
        <div className="consent-actions">
          <p>
            Revocation clears the current workspace’s cached answers and blocks
            future access. Previously downloaded information cannot be recalled.
          </p>
          <button
            className={`button ${active ? "danger" : "primary"}`}
            disabled={busy}
            onClick={() =>
              void mutate(
                `/consents/${w.consent.id}/${active ? "revoke" : "grant"}`,
                {},
                active
                  ? "Consent revoked. Restricted evidence and cached answers removed."
                  : "Demo consent granted. Evidence refreshed.",
              )
            }
          >
            {active ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}{" "}
            {active ? "Revoke permission" : "Grant demo permission"}
          </button>
        </div>
      </section>
      <section className="panel admin-panel">
        <div className="panel-heading">
          <h2>Demonstration access boundaries</h2>
          <Badge tone="amber">Synthetic consent</Badge>
        </div>
        <div className="policy-rows">
          <p>
            <Check size={16} />
            The backend checks permissions before returning record content.
          </p>
          <p>
            <Check size={16} />
            Source reports and FHIR endpoints use the same patient and consent
            boundaries.
          </p>
          <p>
            <AlertTriangle size={16} />
            This is a local consent simulation, not an ABDM consent-manager
            integration.
          </p>
        </div>
      </section>
    </div>
  );
}

export function IntegrationPage({
  w,
  bootstrap,
  mutate,
  busy,
}: {
  w: Workspace;
  bootstrap: Bootstrap;
  mutate: Mutate;
  busy: boolean;
}) {
  const previewKey = `${w.patient.id}|${w.consent.version}|${w.records.map((r) => r.id + r.version).join(",")}|${w.hospitals.map((h) => h.status).join(",")}`;
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  async function loadPreview() {
    setError("");
    try {
      const data = await api<{ bundle: unknown }>(
        `/patients/${w.patient.id}/document-preview`,
      );
      setPayload(JSON.stringify(data.bundle, null, 2));
      setResult(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    let alive = true;
    setPayload("");
    setResult(null);
    api<{ bundle: unknown }>(`/patients/${w.patient.id}/document-preview`)
      .then((data) => {
        if (alive) {
          setPayload(JSON.stringify(data.bundle, null, 2));
          setResult(null);
        }
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [previewKey]);
  async function validate() {
    setError("");
    setResult(null);
    setValidating(true);
    try {
      const bundle = JSON.parse(payload);
      setResult(await post<ValidationResult>("/validate", { bundle }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setValidating(false);
    }
  }
  return (
    <div className="admin-page">
      <header className="page-heading">
        <span className="large-icon">
          <Link2 size={25} />
        </span>
        <div>
          <h1>Integration lab</h1>
          <p>
            Inspect hospital adapters, terminology mappings, and the limits of
            local validation.
          </p>
        </div>
      </header>
      <PipelinePanel workspace={w} mutate={mutate} busy={busy}/>
      <div className="connector-grid">
        {w.hospitals.map((h) => (
          <section className="panel connector-panel" key={h.id}>
            <div className="panel-heading">
              <h2>
                <span className={`hospital-dot hospital-${h.id}`}>{h.id}</span>
                {h.name}
              </h2>
              <Badge tone={h.status === "connected" ? "mint" : "coral"}>
                {h.status}
              </Badge>
            </div>
            <p>{h.format}</p>
            <div className="connector-details">
              <span>{h.recordCount} permitted records</span>
              <span>Checked {time(h.lastChecked)}</span>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void mutate(
                  `/hospitals/${h.id}/status`,
                  {
                    available: h.status !== "connected",
                    patientId: w.patient.id,
                  },
                  h.status === "connected"
                    ? `${h.name} disconnected. Coverage updated.`
                    : `${h.name} reconnected.`,
                )
              }
            >
              <Unplug size={15} />
              {h.status === "connected"
                ? "Simulate outage"
                : "Reconnect source"}
            </button>
          </section>
        ))}
      </div>
      <div className="integration-columns">
        <section className="panel admin-panel">
          <div className="panel-heading">
            <h2>
              <Database size={19} />
              Validated mappings
            </h2>
            <Badge tone="blue">{w.mappings.length} supported</Badge>
          </div>
          <div className="mapping-table">
            {w.mappings.map((m, i) => (
              <div key={i}>
                <span>{m.source}</span>
                <ArrowRight size={13} />
                <div>
                  <strong>{m.canonical}</strong>
                  <small>
                    {m.code} · {m.system}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {w.mappingIssues.map((issue) => (
            <div className="mapping-error" key={issue.id}>
              <AlertTriangle size={16} />
              <div>
                <strong>{issue.suppliedValue}</strong>
                <p>{issue.message}</p>
                <small>
                  Source {issue.sourceId} · {issue.field}
                </small>
              </div>
            </div>
          ))}
        </section>
        <section className="panel admin-panel">
          <div className="panel-heading">
            <h2>
              <Code2 size={19} />
              FHIR validation
            </h2>
            <button className="button small" onClick={() => void loadPreview()}>
              Load draft document
            </button>
          </div>
          <label className="label" htmlFor="fhir-input">
            Draft FHIR document JSON
          </label>
          <textarea
            className="code-input"
            id="fhir-input"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
          />
          <button
            className="button primary"
            disabled={validating}
            onClick={() => void validate()}
          >
            {validating ? "Checking…" : "Run structural checks"}
          </button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div className="validation-result">
              <Badge tone={result.valid ? "mint" : "coral"}>
                {result.valid ? "Local checks passed" : "Validation failed"}
              </Badge>
              {result.checks.map((c, i) => (
                <p key={i}>
                  <StatusIcon passed={c.passed} />
                  {c.label}
                </p>
              ))}
              {result.errors.map((e, i) => (
                <p className="coral-text" key={i}>
                  {e}
                </p>
              ))}
              <small>{result.notice}</small>
            </div>
          )}
          <p className="panel-footnote">
            Structural demo checks are not full ABDM profile or terminology
            certification.
          </p>
        </section>
      </div>
      <section className="panel admin-panel provenance-panel" aria-labelledby="provenance-heading">
        <div className="panel-heading">
          <h2 id="provenance-heading"><Link2 size={19} />Record provenance</h2>
          <Badge>{w.records.length} permitted records</Badge>
        </div>
        <p className="provenance-description">
          Follow each record back to its source hospital. Yellow is the selected
          patient, white nodes are hospitals, and vermilion nodes are source
          records. Connections show where evidence came from, not a medical cause.
        </p>
        {busy ? <Busy label="Updating authorized evidence…" /> : <EvidenceGraph
          key={previewKey}
          graph={w.graph}
          colors={GRAPH_PALETTE}
        />}
        <p className="panel-footnote">Only the currently permitted records are included. Selecting a node shows its source relationships; the evidence list also supports keyboard navigation.</p>
      </section>
      <ServicesPanel bootstrap={bootstrap} />
    </div>
  );
}

export function ServicesPanel({ bootstrap }: { bootstrap: Bootstrap }) {
  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <h2>
          <Database size={19} />
          Service configuration
        </h2>
        <Badge tone="amber">{bootstrap.services.some(service => service.status === "deployed") ? "Deployed prototype" : "Development prototype"}</Badge>
      </div>
      <div className="service-list">
        {bootstrap.services.map((service) => (
          <div key={service.name}>
            <span
              className={`service-status ${service.status !== "not-configured" ? "online" : ""}`}
            />
            <div>
              <strong>{service.name}</strong>
              <p>{service.detail}</p>
            </div>
            <Badge tone={service.status !== "not-configured" ? "mint" : "muted"}>
              {{local:"Development",deployed:"Deployed",configured:"Configured",browser:"Browser", "not-configured":"Not configured"}[service.status]}
            </Badge>
          </div>
        ))}
      </div>
      <p className="panel-footnote">
        Cloud-hosted prototype using fictional comparison records and public repository samples. Hospital exchange is simulated; official ABDM connectivity and approval are not claimed. Transfer receipts and cited answers show completed operations.
      </p>
    </section>
  );
}

export function AuditPage({ w }: { w: Workspace }) {
  const [events, setEvents] = useState<AuditEvent[]>(w.audit);
  const [auditError, setAuditError] = useState("");
  useEffect(() => {
    let alive = true;
    api<{ events: AuditEvent[] }>("/audit")
      .then((data) => {
        if (alive) setEvents(data.events);
      })
      .catch((err) => {
        if (alive) setAuditError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [w.patient.id, w.revision]);
  return (
    <div className="admin-page">
      <header className="page-heading">
        <span className="large-icon">
          <ShieldCheck size={25} />
        </span>
        <div>
          <h1>Audit trail</h1>
          <p>
            Trace record access, consent changes, identity decisions, and
            approved exports.
          </p>
        </div>
      </header>
      <section className="panel audit-panel">
        <div className="panel-heading">
          <h2>Session activity</h2>
          <Badge tone="blue">{events.length} events</Badge>
        </div>
        {auditError && (
          <p className="inline-error" role="alert">
            {auditError}
          </p>
        )}
        {events.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time · IST</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Outcome</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {[...events]
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .map((event) => (
                    <tr key={event.id}>
                      <td>
                        {time(event.timestamp)}
                        <small>{date(event.timestamp)}</small>
                      </td>
                      <td>{event.action.replaceAll("_", " ")}</td>
                      <td>{event.actor}</td>
                      <td>
                        <Badge
                          tone={
                            event.outcome === "denied"
                              ? "coral"
                              : event.outcome === "allowed"
                                ? "mint"
                                : "blue"
                          }
                        >
                          {event.outcome}
                        </Badge>
                      </td>
                      <td>{event.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No events yet">
            Actions in this session will appear here.
          </Empty>
        )}
        <p className="panel-footnote">
          Session-scoped demonstration log. Production requires a persistent,
          protected audit store.
        </p>
      </section>
    </div>
  );
}
