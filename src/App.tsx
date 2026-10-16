"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  UsersRound,
  ShieldCheck,
  Settings2,
  ScrollText,
  Download,
  Check,
  X,
  Menu,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Database,
  LockKeyhole,
} from "lucide-react";
import type {
  Bootstrap,
  ClinicalRecord,
  Citation,
  SourceRecord,
  Workspace,
} from "../shared/types";
import { api, ApiError, apiBase, date, download, post, time } from "./lib/api";
import AuthForm, { type AuthConfiguration } from "./AuthForm";
import { Badge, Busy, CitationButtons, Empty, Modal } from "./components";
import { ConflictBanner, SummaryPanel, TimelinePanel } from "./ClinicalPanels";
import RecordChat from "./RecordChat";
import ComparisonPanel from "../web/ComparisonPanel";
import {
  AuditPage,
  ConsentPage,
  IntegrationPage,
  MatchingPage,
  ServicesPanel,
} from "./AdminPages";

type Page = "workspace" | "matching" | "consent" | "integration" | "audit";
type Dialog = "review" | "findings" | "services" | "patients" | null;
type RecordResponse = {
  record: ClinicalRecord;
  source?: SourceRecord;
  citation: Citation;
  validation: { valid: boolean; level: string; notice: string };
};
const navigation = [
  { id: "workspace", label: "Workspace", icon: FileText },
  { id: "matching", label: "Patient matching", icon: UsersRound },
  { id: "consent", label: "Consent center", icon: ShieldCheck },
  { id: "integration", label: "Integration lab", icon: Settings2 },
  { id: "audit", label: "Audit trail", icon: ScrollText },
] as const;

export default function App({ comparison = false }: { comparison?: boolean } = {}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [w, setW] = useState<Workspace | null>(null);
  const [patientId, setPatientId] = useState("ravi");
  const [page, setPage] = useState<Page>("workspace");
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [source, setSource] = useState<RecordResponse | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [authConfiguration, setAuthConfiguration] = useState<AuthConfiguration | null>(null);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const sourceEpoch = useRef(0);
  const initialized = useRef(false);
  async function initialize() {
    setInitializing(true);
    setError("");
    let configuration = authConfiguration;
    try {
      configuration = await api<AuthConfiguration>("/auth/config");
      setAuthConfiguration(configuration);
      if (configuration.provider === "supabase" && !configuration.supabaseConfigured) {
        setAuthenticationRequired(true);
        setW(null);
        setBootstrap(null);
        return;
      }
      if (configuration.provider === "demo") await post("/demo/session");
      const boot = await api<Bootstrap>("/bootstrap");
      if (comparison) boot.patients = boot.patients.filter(patient => patient.id === "ravi");
      setBootstrap(boot);
      const id = boot.patients[0]?.id || "ravi";
      setPatientId(id);
      setW(comparison ? await post<Workspace>("/comparison/session") : await api<Workspace>(`/patients/${id}/workspace`));
      setAuthenticationRequired(false);
    } catch (err) {
      setError((err as Error).message);
      setW(null);
      setBootstrap(null);
      if (configuration?.provider === "supabase" && err instanceof ApiError && [401, 403].includes(err.status)) setAuthenticationRequired(true);
    } finally {
      setInitializing(false);
    }
  }
  function reportError(err: unknown) {
    setError((err as Error).message);
    if (err instanceof ApiError && err.status === 401) {
      sourceEpoch.current++;
      setSource(null);
      setSourceLoading(false);
      setDialog(null);
      setW(null);
      setBootstrap(null);
      setAuthenticationRequired(authConfiguration?.provider === "supabase");
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await post("/auth/logout");
      sourceEpoch.current++;
      setSource(null);
      setDialog(null);
      setW(null);
      setBootstrap(null);
      setAuthenticationRequired(true);
      setError("");
    } catch (err) { reportError(err); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void initialize();
    }
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setDialog("patients");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  async function selectPatient(id: string) {
    if (id === patientId) {
      setDialog(null);
      return;
    }
    sourceEpoch.current++;
    setSourceLoading(false);
    setLoading(true);
    setDialog(null);
    setSource(null);
    setError("");
    try {
      const next = await api<Workspace>(`/patients/${id}/workspace`);
      setPatientId(id);
      setW(next);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }
  async function mutate(
    path: string,
    body: unknown = {},
    message = "Workspace updated.",
  ) {
    sourceEpoch.current++;
    setSourceLoading(false);
    setBusy(true);
    setError("");
    try {
      const next = await post<Workspace>(path, body);
      setW(next);
      setSource(null);
      setToast(message);
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }
  async function openRecord(id: string) {
    const epoch = ++sourceEpoch.current;
    setDialog(null);
    setSource(null);
    setSourceLoading(true);
    setError("");
    try {
      const record = await api<RecordResponse>(`/records/${id}`);
      if (sourceEpoch.current === epoch) setSource(record);
    } catch (err) {
      if (sourceEpoch.current === epoch) reportError(err);
    } finally {
      if (sourceEpoch.current === epoch) setSourceLoading(false);
    }
  }
  async function refresh() {
    setLoading(true);
    try {
      setW(await api<Workspace>(`/patients/${patientId}/workspace`));
      setToast("Source coverage and permissions checked.");
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }
  if (!initializing && authenticationRequired && authConfiguration?.provider === "supabase") return <AuthForm configuration={authConfiguration} initialError={error} onSignedIn={initialize} onRetry={() => void initialize()}/>;
  if (initializing || !bootstrap || !w)
    return (
      <main className="boot-screen">
        <div className="brand-symbol">
          <span />
          <span />
        </div>
        <h1>Clinical workspace</h1>
        {initializing ? (
          <Busy label="Connecting the synthetic hospital adapters…" />
        ) : (
          <>
            <p className="inline-error" role="alert">
              {error || "Workspace is unavailable."}
            </p>
            <button
              className="button primary"
              onClick={() => void initialize()}
            >
              Try again
            </button>
          </>
        )}
      </main>
    );
  const currentNavigation = navigation.find((n) => n.id === page)!;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          href="#"
          className="brand"
          aria-label="Zuma workspace"
          onClick={(e) => {
            e.preventDefault();
            setPage("workspace");
            setMobileNav(false);
          }}
        >
          <span>
            Zuma
            <br />
            workspace
          </span>
        </a>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => {
                setPage(id);
                setMobileNav(false);
              }}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{label}</span>
              {id === "matching" &&
                w.candidates.some((c) => c.status === "review-required") && (
                  <span className="nav-notification" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="synthetic-warning">
            <span className="synthetic-icon">
              <LockKeyhole size={17} />
            </span>
            <div>
              <strong>Using synthetic data</strong>
              <p>Fictional patients and records for demonstration only.</p>
            </div>
          </div>
          <button
            className="doctor-profile"
            onClick={() => setDialog("services")}
          >
            <span className="avatar doctor-avatar">AI</span>
            <span>
              <strong>{bootstrap.actor.name}</strong>
              <small>Hospital B · {authConfiguration?.provider === "supabase" ? "Authorized clinician" : "Demo clinician"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <a
              href="/"
              className="overview-link"
              aria-label="Back to product overview"
              title="Product overview"
            >
              <ArrowLeft size={18} />
            </a>
            <button onClick={() => setPage("workspace")}>Workspace</button>
            <span>/</span>
            <span>
              {page === "workspace"
                ? "Patient review"
                : currentNavigation.label}
            </span>
          </div>
          <button
            className="patient-search"
            onClick={() => {
              setQuery("");
              setDialog("patients");
            }}
          >
            <Search size={17} />
            <span>Search for a patient by name, MRN or ID</span>
            <kbd>⌘ K</kbd>
          </button>
        </header>
        <main className="main-content">
          {comparison && <div className="notice-strip" style={{ marginBottom: 16 }}><p><strong>Two hospitals. One fictional patient.</strong> Simulated exchange and hospital records; separate from the public NHA samples. <a href="/workspace">Open repository patients ↗</a></p></div>}
          <section className="patient-header" aria-label="Current patient">
            <div className="patient-title">
              <h1>{w.patient.name}</h1>
              <p>
                {w.patient.age} years
                <span />
                {w.patient.sex}
                <span />
                MRN {w.patient.identifiers.at(-1)?.value || "—"}
                <span />
                {comparison && !w.access.allowed ? "Source identifiers (link/access pending):" : "Linked records:"}{" "}
                {w.patient.identifiers.map((p) => p.value).join(", ")}
              </p>
            </div>
            <button
              className="button primary review-button"
              onClick={() => setDialog("review")}
              disabled={busy || !w.summary}
            >
              <Download size={17} />
              Review & export
              <ChevronDown size={16} />
            </button>
          </section>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <Busy label="Checking the permitted records…" />
          ) : page === "workspace" ? (
            <>
              {comparison && <ComparisonPanel workspace={w} busy={busy} onRetrieved={setW} onOpen={id => void openRecord(id)} onIdentity={() => setPage("matching")} onConsent={() => setPage("consent")} onReview={() => setDialog("review")} />}
              {!w.records.length && <div className="notice-strip" style={{ margin: "0 0 12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}><p>Retrieve the permitted hospital records to begin this patient’s review.</p><button className="button primary small" onClick={() => setPage("integration")}>Open hospital retrieval</button></div>}
              <ConflictBanner
                workspace={w}
                onReview={() => setDialog("findings")}
              />
              <div className="clinical-grid">
                <SummaryPanel
                  workspace={w}
                  busy={busy}
                  openRecord={(id) => void openRecord(id)}
                  onGenerate={() =>
                    void mutate(
                      `/patients/${patientId}/summary`,
                      {},
                      "Evidence-linked draft regenerated.",
                    )
                  }
                />
                <TimelinePanel
                  workspace={w}
                  busy={busy}
                  openRecord={(id) => void openRecord(id)}
                />
                <RecordChat
                  requireKnowledgeBase={comparison}
                  workspace={w}
                  onOpen={(id) => void openRecord(id)}
                />
              </div>
            </>
          ) : page === "matching" ? (
            <MatchingPage w={w} busy={busy} mutate={mutate} />
          ) : page === "consent" ? (
            <ConsentPage w={w} busy={busy} mutate={mutate} />
          ) : page === "integration" ? (
            <IntegrationPage
              key={w.patient.id}
              w={w}
              bootstrap={bootstrap}
              busy={busy}
              mutate={mutate}
            />
          ) : (
            <AuditPage w={w} />
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={12} />
            Synthetic prototype · not connected to live hospitals or ABDM
          </span>
          <button onClick={() => setDialog("services")}>
            <Database size={12} />
            Provider status
            <ArrowUpRight size={11} />
          </button>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {sourceLoading && (
        <Modal
          title="Opening source record"
          onClose={() => {
            sourceEpoch.current++;
            setSourceLoading(false);
          }}
        >
          <Busy />
        </Modal>
      )}
      {source && <SourceDialog data={source} onClose={() => setSource(null)} />}
      {dialog === "review" && (
        <ReviewDialog
          workspace={w}
          busy={busy}
          onClose={() => setDialog(null)}
          onApprove={(text) =>
            mutate(
              `/patients/${patientId}/approve`,
              { text, sourceVersion: w.summary?.sourceVersion },
              "Clinician-reviewed summary approved.",
            )
          }
          onError={setError}
        />
      )}
      {dialog === "findings" && (
        <Modal
          title="Evidence requiring review"
          subtitle="The system preserves disagreements. An authorized clinician determines what they mean."
          wide
          onClose={() => setDialog(null)}
        >
          <div className="findings-list">
            {w.findings.length ? (
              w.findings.map((f) => (
                <article className={`finding ${f.category}`} key={f.id}>
                  <div>
                    <Badge
                      tone={
                        f.category === "conflict"
                          ? "coral"
                          : f.category === "missing"
                            ? "amber"
                            : "blue"
                      }
                    >
                      {f.category}
                    </Badge>
                    <Badge>{f.status.replaceAll("-", " ")}</Badge>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                  <CitationButtons
                    ids={f.citationIds}
                    citations={w.citations}
                    onOpen={(id) => void openRecord(id)}
                  />
                </article>
              ))
            ) : (
              <Empty title="No findings from available evidence" />
            )}
          </div>
        </Modal>
      )}
      {dialog === "services" && (
        <Modal
          title="System & provider status"
          subtitle="Deployment and configuration details. Completed transfers and answers verify individual requests."
          wide
          onClose={() => setDialog(null)}
        >
          <ServicesPanel bootstrap={bootstrap} />
          {authConfiguration?.provider === "supabase" && <div className="modal-actions"><button className="button" disabled={busy} onClick={() => void signOut()}>{busy ? "Signing out…" : "Sign out"}</button></div>}
        </Modal>
      )}
      {dialog === "patients" && (
        <Modal
          title="Open a patient workspace"
          subtitle="All patients in this demonstration are fictional."
          onClose={() => setDialog(null)}
        >
          <div className="search-field">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search synthetic patients"
              placeholder="Search name or patient identifier"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="patient-options">
            {bootstrap.patients
              .filter((p) =>
                `${p.name} ${p.identifier}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => (
                <button key={p.id} onClick={() => void selectPatient(p.id)}>
                  <span className="avatar">{p.initials}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.identifier} · {p.age} years · {p.sex}
                    </small>
                    <small>{p.reason}</small>
                  </span>
                  {p.id === patientId ? (
                    <Check size={18} className="mint-text" />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SourceDialog({
  data,
  onClose,
}: {
  data: RecordResponse;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("report");
  const r = data.record;
  return (
    <Modal
      title={r.title}
      subtitle={`${r.hospital} · MRN ${r.patientLocalId} · Source version ${r.version}`}
      wide
      onClose={onClose}
    >
      <div className="source-topline">
        <Badge tone="mint">Authorized evidence</Badge>
        <span>Clinical date {date(r.clinicalDate)}</span>
        <span>
          Retrieved {date(r.retrievedAt)} at {time(r.retrievedAt)}
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Source record view">
        {[
          { id: "report", name: "Clinical report" },
          { id: "native", name: "Original hospital data" },
          { id: "fhir", name: "FHIR resource" },
        ].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      {tab === "report" ? (
        <div className="report-document">
          <div className="report-hospital">
            <span className={`hospital-dot hospital-${r.hospitalId}`}>
              {r.hospitalId}
            </span>
            <div>
              <h3>{r.hospital}</h3>
              <p>Synthetic medical record · {r.id}</p>
            </div>
          </div>
          <h2>{r.title}</h2>
          {r.kind === "lab" && (
            <div className="lab-result-value">
              <span className="label">Recorded result</span>
              <strong>
                {r.value} <span>{r.unit}</span>
              </strong>
              <small>
                {r.codeSystem}: {r.code}
              </small>
            </div>
          )}
          <p className="report-text">{r.text}</p>
          <blockquote>{data.citation.quote}</blockquote>
          <div className="notice-strip">
            <ShieldCheck size={17} />
            <p>{data.validation.notice}</p>
          </div>
        </div>
      ) : (
        <pre className="json-view">
          {JSON.stringify(
            tab === "native"
              ? data.source?.payload || {
                  notice: "Native source is not available for this request.",
                }
              : r.fhir,
            null,
            2,
          )}
        </pre>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Close report
        </button>
        <button
          className="button"
          onClick={() =>
            download(JSON.stringify(r.fhir, null, 2), `${r.id}.json`)
          }
        >
          <Download size={15} />
          Download record JSON
        </button>
      </div>
    </Modal>
  );
}

function ReviewDialog({
  workspace: w,
  onClose,
  busy,
  onApprove,
  onError,
}: {
  workspace: Workspace;
  onClose: () => void;
  busy: boolean;
  onApprove: (text: string) => Promise<void>;
  onError: (value: string) => void;
}) {
  const [text, setText] = useState(w.summary?.text || "");
  const [format, setFormat] = useState("fhir");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const approved = w.summary?.status === "approved" && text === w.summary.text;
  async function exportSummary() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase}/api/patients/${w.patient.id}/export?format=${format}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || "Export denied.");
      }
      const body = await response.text();
      download(
        body,
        `synthetic-${w.patient.id}-summary.${format === "fhir" ? "json" : "html"}`,
        format === "fhir" ? "application/json" : "text/html",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <Modal
      title="Review & export"
      subtitle="Review every statement against the source evidence before approving this version."
      wide
      onClose={onClose}
    >
      <div className="review-topline">
        <Badge tone={approved ? "mint" : "amber"}>
          {approved ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}{" "}
          {approved ? "Approved version" : "Clinician review required"}
        </Badge>
        <span>{w.summary?.recordCount || 0} source records</span>
      </div>
      <label className="label" htmlFor="summary-editor">
        Clinical summary draft
      </label>
      <textarea
        className="summary-editor"
        id="summary-editor"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <div className="notice-strip">
        <AlertTriangle size={17} />
        <p>
          {w.summary?.disclaimer || "Synthetic demonstration only."} Edits do
          not automatically resolve source contradictions.
        </p>
      </div>
      {w.findings.filter((f) => f.category === "conflict").length > 0 && (
        <p className="coral-text review-conflict">
          Conflicting source records remain visible and require clinical
          verification.
        </p>
      )}
      <div className="export-settings">
        <div>
          <label className="label" htmlFor="export-format">
            Export format
          </label>
          <select
            id="export-format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="fhir">FHIR document JSON</option>
            <option value="html">Readable HTML report</option>
          </select>
        </div>
        <p>
          FHIR export uses server-side structural checks. Full ABDM profile
          certification is not provided.
        </p>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Close
        </button>
        <button
          className="button"
          disabled={busy || approved || !text.trim()}
          onClick={() => void onApprove(text)}
        >
          <Check size={15} />
          {busy ? "Saving…" : approved ? "Approved" : "Approve this version"}
        </button>
        <button
          className="button primary"
          disabled={!approved || exporting || busy}
          onClick={() => void exportSummary()}
        >
          <Download size={15} />
          {exporting ? "Checking access…" : "Export approved report"}
        </button>
      </div>
    </Modal>
  );
}
