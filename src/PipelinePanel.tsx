"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CloudUpload, Database, RefreshCw, ShieldCheck } from "lucide-react";
import type { HospitalId, Workspace } from "../shared/types";
import type { Mutate } from "./AdminPages";
import { Badge, Busy } from "./components";
import { api, ApiError, date, post, time } from "./lib/api";

interface PipelineConfiguration {
  authProvider: "demo" | "supabase";
  stateStore: string;
  recordProvider: "api" | "fixtures";
  ragProvider: string;
  aiProvider: string;
  awsEnabled: boolean;
  knowledgeBaseConfigured: boolean;
  hospitals?: Partial<Record<HospitalId, { configured: boolean; error?: string }>>;
  notice: string;
}
interface IngestionJob {
  jobId: string;
  status?: string;
  startedAt?: string | null;
  updatedAt?: string | null;
  records?: number;
  documents?: number;
  metadataFiles?: number;
  ready: boolean;
  statistics?: Record<string, unknown>;
  failureCount?: number;
}

export default function PipelinePanel({ workspace: w, mutate, busy }: { workspace: Workspace; mutate: Mutate; busy: boolean }) {
  const [configuration, setConfiguration] = useState<PipelineConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [job, setJob] = useState<IngestionJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [working, setWorking] = useState(false);
  const epoch = useRef(0);
  const scope = `${w.patient.id}|${w.consent.version}|${w.summary?.sourceVersion || w.revision}`;

  async function refreshConfiguration() {
    setConfigurationError("");
    try { setConfiguration(await api<PipelineConfiguration>("/pipeline/status")); }
    catch (err) { setConfiguration(null); setConfigurationError((err as Error).message); }
  }
  useEffect(() => {
    let alive = true;
    api<PipelineConfiguration>("/pipeline/status").then(data => { if (alive) setConfiguration(data); }).catch(err => { if (alive) setConfigurationError((err as Error).message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    epoch.current++;
    setJob(null);
    setJobError("");
    setWorking(false);
    return () => { epoch.current++; };
  }, [scope]);

  async function startIngestion() {
    const requestEpoch = epoch.current;
    setWorking(true);
    setJobError("");
    try {
      const result = await post<IngestionJob>(`/patients/${w.patient.id}/ingest`);
      if (requestEpoch === epoch.current) setJob(result);
    } catch (err) { if (requestEpoch === epoch.current) setJobError((err as Error).message); }
    finally { if (requestEpoch === epoch.current) setWorking(false); }
  }
  async function checkIngestion() {
    if (!job) return;
    const requestEpoch = epoch.current;
    setWorking(true);
    setJobError("");
    try {
      const result = await api<IngestionJob>(`/patients/${w.patient.id}/ingestion?jobId=${encodeURIComponent(job.jobId)}`);
      if (requestEpoch === epoch.current) setJob(previous => ({ ...previous, ...result }));
    } catch (err) {
      if (requestEpoch === epoch.current) {
        setJobError((err as Error).message);
        if (err instanceof ApiError && [401, 403, 409].includes(err.status)) setJob(null);
      }
    } finally { if (requestEpoch === epoch.current) setWorking(false); }
  }
  const canSync = configuration?.recordProvider === "api";
  const canIndex = Boolean(configuration?.awsEnabled && configuration.knowledgeBaseConfigured && w.records.length);
  const receiptRows = w.deliveries ?? [];

  return <section className="panel admin-panel" aria-labelledby="pipeline-heading">
    <div className="panel-heading"><h2 id="pipeline-heading"><Database size={19}/>Hospital delivery & evidence pipeline</h2><button className="subtle-link" onClick={() => void refreshConfiguration()} disabled={busy || working}><RefreshCw size={12}/>Refresh provider status</button></div>
    <p style={{ fontSize: 13, color: "#666", marginTop: 16 }}>Retrieve native records from the two hospital APIs, then optionally index the permitted evidence in S3 and Amazon Bedrock.</p>
    {configurationError && <p className="inline-error" role="alert" style={{ marginTop: 14 }}>{configurationError}</p>}
    {!configuration && !configurationError && <Busy label="Reading provider configuration…"/>}
    {configuration && <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 16 }}><Badge>Records: {configuration.recordProvider === "api" ? "Hospital APIs" : "Local fixtures"}</Badge><Badge>State: {configuration.stateStore}</Badge><Badge>AI: {configuration.aiProvider}</Badge><Badge>RAG: {configuration.ragProvider}</Badge><Badge tone={configuration.awsEnabled ? "mint" : "muted"}>AWS {configuration.awsEnabled ? "enabled" : "disabled"}</Badge></div>}
    {configuration?.recordProvider === "api" && (["A", "B"] as HospitalId[]).filter(id => configuration.hospitals?.[id]?.configured === false).map(id => <p key={id} className="inline-error" role="status" style={{ marginTop: 12 }}>Hospital {id} endpoint or service credentials are not configured. {configuration.hospitals?.[id]?.error || "Review the hospital connector settings."}</p>)}
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 20 }}>{(["A", "B"] as HospitalId[]).map(hospitalId => <button key={hospitalId} className="button" disabled={busy || working || !canSync || (hospitalId === "A" && !w.access.allowed)} onClick={() => void mutate(`/patients/${w.patient.id}/sync`, { hospitals: [hospitalId] }, `Hospital ${hospitalId} request completed. Review the delivery receipt and source status.`)}><ArrowDownToLine size={15}/>Retrieve Hospital {hospitalId}</button>)}<button className="button primary" disabled={busy || working || !canSync || !w.access.allowed} onClick={() => void mutate(`/patients/${w.patient.id}/sync`, { hospitals: ["A", "B"] }, "Hospital requests completed. Review delivery receipts and source coverage.")}><RefreshCw size={15}/>{busy ? "Requesting records…" : "Retrieve both hospitals"}</button></div>
    {!canSync && configuration && <p className="notice-strip">Hospital API retrieval is not selected on the server. The current workspace uses local fixtures; no external hospital transmission is implied.</p>}
    {!w.access.allowed && <p className="notice-strip"><ShieldCheck size={16}/>{w.access.reason} Hospital B’s local records can still be requested.</p>}
    <div style={{ marginTop: 23 }}><h3 style={{ fontSize: 14 }}>Latest delivery receipts</h3>{receiptRows.length ? <div className="table-scroll"><table style={{ minWidth: 620 }}><thead><tr><th>Source</th><th>Received · IST</th><th>Records</th><th>Request ID</th><th>Revision</th></tr></thead><tbody>{receiptRows.map(receipt => <tr key={`${receipt.hospitalId}-${receipt.requestId}`}><td>Hospital {receipt.hospitalId}</td><td>{time(receipt.receivedAt)}<small>{date(receipt.receivedAt)}</small></td><td>{receipt.recordCount}</td><td><code style={{ fontSize: 10 }}>{receipt.requestId}</code></td><td><code style={{ fontSize: 10 }}>{receipt.revision}</code></td></tr>)}</tbody></table></div> : <p style={{ fontSize: 12, color: "#666", marginTop: 9 }}>No successful hospital API delivery has been recorded for this patient in this session.</p>}</div>
    <div style={{ borderTop: "1px solid #dedede", marginTop: 24, paddingTop: 22 }}><h3 style={{ fontSize: 15 }}>S3 upload & Bedrock indexing</h3><p style={{ color: "#666", fontSize: 12, margin: "9px 0 15px", maxWidth: 800 }}>This action uploads the currently permitted synthetic evidence to configured S3 storage and starts a Bedrock ingestion job. A successful upload does not mean indexing has completed.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}><button className="button primary" disabled={busy || working || !canIndex} onClick={() => void startIngestion()}><CloudUpload size={16}/>{working ? "Contacting the configured service…" : "Upload evidence & start indexing"}</button>{job && <button className="button" disabled={busy || working} onClick={() => void checkIngestion()}><RefreshCw size={15}/>Check indexing status</button>}</div>{configuration && !canIndex && <p className="notice-strip">{!w.records.length ? "Retrieve permitted records before indexing." : !configuration.awsEnabled ? "AWS processing is disabled in the current server configuration." : "The Bedrock knowledge base and data source are not configured."}</p>}{jobError && <p className="inline-error" role="alert" style={{ marginTop: 13 }}>{jobError}</p>}{job && <div className="notice-strip" style={{ display: "block", marginTop: 16 }} role="status"><div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><Badge tone={job.ready ? "mint" : "amber"}>{job.ready ? "Indexing complete" : job.status || "Submitted"}</Badge><code style={{ fontSize: 11 }}>{job.jobId}</code></div><p style={{ marginTop: 9 }}>{job.documents ?? job.records ?? "—"} evidence documents · {job.metadataFiles ?? "—"} metadata files</p>{job.failureCount !== undefined && <p>Reported failures: {job.failureCount}</p>}{job.statistics && Object.entries(job.statistics).filter(([, value]) => typeof value === "number").map(([key, value]) => <p key={key} style={{ fontSize: 11 }}>{key}: {String(value)}</p>)}<p style={{ fontSize: 11, marginTop: 8 }}>{job.ready ? "The configured service reports this job complete. Answers still require current permissions and source verification." : "Indexing readiness has not been confirmed. Use Check indexing status to request an update."}</p></div>}</div>
    <p className="panel-footnote">Configuration flags are separate from successful requests. Receipts and job responses above reflect completed service calls.</p>
  </section>;
}
