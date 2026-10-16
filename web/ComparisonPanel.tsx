"use client";

import type { ClinicalRecord, Workspace } from "../shared/types";
import { useState } from "react";
import { api, post } from "../src/lib/api";
import "./comparison.css";

export default function ComparisonPanel({ workspace: w, busy, onOpen, onIdentity, onConsent, onReview, onRetrieved }: {
  workspace: Workspace;
  busy: boolean;
  onOpen: (id: string) => void;
  onIdentity: () => void;
  onConsent: () => void;
  onReview: () => void;
  onRetrieved: (workspace: Workspace) => void;
}) {
  const [exchanging, setExchanging] = useState(false), [receipt, setReceipt] = useState("");
  async function exchange() {
    setExchanging(true); setReceipt("");
    try {
      const consent = await post<{consentId:string}>("/abdm-mock/v1/consent-init");
      const result = await post<{transferId:string;fhirResources:number;digest:string}>("/abdm-mock/v1/health-information/fetch-records", {consentId:consent.consentId});
      await api(`/abdm-mock/v1/health-information/status/${result.transferId}`);
      onRetrieved(await api<Workspace>("/patients/ravi/workspace"));
      setReceipt(`HIP A → mock gateway → HIU B: ${result.fhirResources} FHIR resources received. Transfer ${result.transferId}. SHA-256 ${result.digest}.`);
    } catch (error) { setReceipt((error as Error).message); }
    finally { setExchanging(false); }
  }
  const [indexing, setIndexing] = useState(false), [indexNotice, setIndexNotice] = useState("");
  const [jobId, setJobId] = useState("");
  async function indexEvidence() {
    setIndexing(true); setIndexNotice("");
    try { const result = await post<{jobId:string;status:string}>("/comparison/ingest"); setJobId(result.jobId); setIndexNotice(`Evidence indexing: ${result.status}. Check its status before asking a question.`); }
    catch (error) { setIndexNotice((error as Error).message); }
    finally { setIndexing(false); }
  }
  async function checkIndex() {
    setIndexing(true);
    try { const result = await api<{status:string;ready:boolean;failureReasons:string[]}>(`/comparison/ingestion/${jobId}`); setIndexNotice(result.ready ? "Evidence indexing completed. Ask Zuma a question and inspect its supporting sources." : `Evidence indexing: ${result.status}. ${result.failureReasons.join(" ")}`); }
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
      <article><strong>Rohit Hospital A · HIP</strong><span>Previous records · A-102</span><small>Supabase records → mock gateway</small></article><span aria-hidden="true">→</span>
      <article className="comparison-center"><strong>ZUMA</strong><span>Identity → permission → FHIR</span><small>Compare → cite → doctor review</small></article><span aria-hidden="true">←</span>
      <article><strong>Nisanth Hospital B · HIU</strong><span>Current records · B-507</span><small>Hospital database + permitted FHIR receipt</small></article>
    </div>
    <p className="comparison-disclosure">Fictional hospital records retrieved from Supabase. HIP, mock gateway and HIU are co-hosted prototype modules; this is not the official NHA gateway runtime or an approved live ABDM connection.</p>
    <div className="comparison-controls"><button className="button primary small" disabled={busy || exchanging || !w.access.allowed} onClick={() => void exchange()}>{exchanging ? "Retrieving hospital records…" : "Retrieve through mock HIP → gateway → HIU"}</button></div>
    {receipt && <p role="status" className="comparison-access" style={{overflowWrap:"anywhere"}}>{receipt}</p>}
    <ol className="comparison-features" aria-label="Seven Zuma features">{features.map((label, i) => <li key={label}><span>{String(i + 1).padStart(2, "0")}</span>{label}</li>)}</ol>
    <div className="comparison-controls"><button className="button small" disabled={busy} onClick={onIdentity}>1. Review patient identity</button><button className="button small" disabled={busy} onClick={onConsent}>2. Check demo permission</button><button className="button primary small" disabled={busy || !w.access.allowed} onClick={onReview}>3. Review & approve</button></div>
    <div className="comparison-controls"><button className="button small" disabled={busy || indexing || !w.access.allowed} onClick={() => void indexEvidence()}>{indexing ? "Checking evidence…" : "Index permitted demo evidence"}</button>{jobId && <button className="button small" disabled={busy || indexing || !w.access.allowed} onClick={() => void checkIndex()}>Check indexing status</button>}<small>Required once when this scenario is new to the knowledge base.</small></div>
    {indexNotice && <p role="status" className="comparison-access">{indexNotice}</p>}
    {!w.access.allowed && <p role="status" className="comparison-access">Hospital A evidence is withheld: {w.access.reason}</p>}
    <div className="comparison-table-wrap"><table><caption>Source comparison · open a value to inspect its original evidence</caption><thead><tr><th scope="col">Medical information</th><th scope="col">Hospital A · previous</th><th scope="col">Hospital B · current</th><th scope="col">Doctor review</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{(["A", "B"] as const).map(hospital => {
      const records = w.records.filter(r => r.hospitalId === hospital && row.select(r));
      return <td key={hospital}>{records.length ? records.map(r => <button className="comparison-source" key={r.id} onClick={() => onOpen(r.id)}><strong>{r.kind === "lab" ? `${r.value} ${r.unit}` : r.kind === "allergy" ? r.title : r.text}</strong><small>{r.clinicalDate.slice(0, 10)} · {r.patientLocalId} · source ↗</small></button>) : <span className="muted">{hospital === "A" && !w.access.allowed ? "Identity / permission required" : "Not available in permitted records"}</span>}</td>;
    })}<td>{w.access.allowed && w.records.some(r => r.hospitalId === "A" && row.select(r)) && w.records.some(r => r.hospitalId === "B" && row.select(r)) ? row.note : "Both permitted source records are needed for comparison."}</td></tr>)}</tbody></table></div>
    <div className="comparison-footnote"><strong>ABDM provides the exchange foundation.</strong><span>ZUMA adds source-linked explanations, record comparison and clinician review. The simulated exchange does not claim national-system approval.</span></div>
  </section>;
}
