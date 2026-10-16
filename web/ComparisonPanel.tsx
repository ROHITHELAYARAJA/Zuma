"use client";

import type { ClinicalRecord, Workspace } from "../shared/types";
import { useState } from "react";
import { post } from "../src/lib/api";
import "./comparison.css";

export default function ComparisonPanel({ workspace: w, busy, onOpen, onIdentity, onConsent, onReview }: {
  workspace: Workspace;
  busy: boolean;
  onOpen: (id: string) => void;
  onIdentity: () => void;
  onConsent: () => void;
  onReview: () => void;
}) {
  const [indexing, setIndexing] = useState(false), [indexNotice, setIndexNotice] = useState("");
  async function indexEvidence() {
    setIndexing(true); setIndexNotice("");
    try { const result = await post<{jobId:string;status:string}>("/comparison/ingest"); setIndexNotice(`AWS ingestion job ${result.jobId}: ${result.status}. Indexing is asynchronous; this is not a completed retrieval check. Try a specific question after ingestion completes.`); }
    catch (error) { setIndexNotice((error as Error).message); }
    finally { setIndexing(false); }
  }
  const rows = [
    { label: "Allergy", select: (r: ClinicalRecord) => r.kind === "allergy", note: "Conflicting statements: doctor verification required." },
    { label: "Metformin", select: (r: ClinicalRecord) => r.kind === "medication" && r.title === "Metformin 500 mg", note: "Different instructions: verify dates and the prescribing record." },
    { label: "Fasting glucose", select: (r: ClinicalRecord) => r.code === "1558-6", note: "A change over time alone is not an error or diagnosis." },
  ];
  const features = ["FHIR format", "Patient identity", "Permission", "Cited summary", "Differences", "Text + voice", "Review + export"];
  return <section className="zuma-comparison" aria-label="Cross-hospital comparison">
    <div className="comparison-heading"><div><span className="label">ZUMA · CROSS-HOSPITAL REVIEW</span><h2>Ravi’s records, together.</h2><p>Compare dated source statements. Keep the doctor in control.</p></div><a href="/workspace">Public repository samples ↗</a></div>
    <div className="comparison-flow" aria-label="Record exchange workflow">
      <article><strong>Rohit Hospital A</strong><span>Previous records · A-102</span><small>Simulated ABDM exchange input</small></article><span aria-hidden="true">→</span>
      <article className="comparison-center"><strong>ZUMA</strong><span>Identity → permission → FHIR</span><small>Compare → cite → doctor review</small></article><span aria-hidden="true">←</span>
      <article><strong>Nisanth Hospital B</strong><span>Current records · B-507</span><small>Simulated hospital database input</small></article>
    </div>
    <p className="comparison-disclosure">Fictional demonstration records stored in this clinician’s session. This is not a live hospital connection or approved ABDM integration. No manual PDF upload is needed for this prepared scenario.</p>
    <ol className="comparison-features" aria-label="Seven Zuma features">{features.map((label, i) => <li key={label}><span>{String(i + 1).padStart(2, "0")}</span>{label}</li>)}</ol>
    <div className="comparison-controls"><button className="button small" disabled={busy} onClick={onIdentity}>1. Review patient identity</button><button className="button small" disabled={busy} onClick={onConsent}>2. Check demo permission</button><button className="button primary small" disabled={busy || !w.access.allowed} onClick={onReview}>3. Review & approve</button></div>
    <div className="comparison-controls"><button className="button small" disabled={busy || indexing || !w.access.allowed} onClick={() => void indexEvidence()}>{indexing ? "Sending permitted evidence…" : "Index permitted demo evidence"}</button><small>Required once when this scenario is new to the knowledge base.</small></div>
    {indexNotice && <p role="status" className="comparison-access">{indexNotice}</p>}
    {!w.access.allowed && <p role="status" className="comparison-access">Hospital A evidence is withheld: {w.access.reason}</p>}
    <div className="comparison-table-wrap"><table><caption>Source comparison · open a value to inspect its original evidence</caption><thead><tr><th scope="col">Medical information</th><th scope="col">Hospital A · previous</th><th scope="col">Hospital B · current</th><th scope="col">Doctor review</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{(["A", "B"] as const).map(hospital => {
      const records = w.records.filter(r => r.hospitalId === hospital && row.select(r));
      return <td key={hospital}>{records.length ? records.map(r => <button className="comparison-source" key={r.id} onClick={() => onOpen(r.id)}><strong>{r.kind === "lab" ? `${r.value} ${r.unit}` : r.kind === "allergy" ? r.title : r.text}</strong><small>{r.clinicalDate.slice(0, 10)} · {r.patientLocalId} · source ↗</small></button>) : <span className="muted">{hospital === "A" && !w.access.allowed ? "Identity / permission required" : "Not available in permitted records"}</span>}</td>;
    })}<td>{w.access.allowed && w.records.some(r => r.hospitalId === "A" && row.select(r)) && w.records.some(r => r.hospitalId === "B" && row.select(r)) ? row.note : "Both permitted source records are needed for comparison."}</td></tr>)}</tbody></table></div>
    <div className="comparison-footnote"><strong>ABDM provides the exchange foundation.</strong><span>ZUMA adds source-linked explanations, record comparison and clinician review. The simulated exchange does not claim national-system approval.</span></div>
  </section>;
}
