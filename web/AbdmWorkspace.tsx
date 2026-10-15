"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthForm, { type AuthConfiguration } from "../src/AuthForm";
import { api, ApiError, post } from "../src/lib/api";
import "./abdm.css";

type Report = { reportId: string; name: string; patientId: string; hospitalId: string; birthDate: string; source: string };
type View = { reportId: string; patientId: string; name: string; birthDate: string; hospitalId: string; sourceUrl: string; sha256: string; sourceVersion: string; allowed: boolean; consent: { active: boolean; expiresAt: string }; approval: { text: string; doctor: string } | null; bundle: { entry: { resource: { resourceType: string; id?: string } }[] } | null; findings: { title: string; detail: string }[]; audit: { id: string; action: string; actor: string; at: string }[]; notice: string };
type Answer = { answer: string; citations: { id: string; title: string; quote: string; sourceUrl: string }[]; warning: string; audioBase64?: string; audioContentType?: string; transcript?: string };
export default function AbdmWorkspace() {
  const [config, setConfig] = useState<AuthConfiguration | null>(null);
  const [login, setLogin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const recorder = useRef<{ stop: () => void } | null>(null);
  const epoch = useRef(0);
  const initialized = useRef(false);
  async function select(id: string) {
    epoch.current++; setAnswer(null); setDraft(""); setError(""); setView(null);
    setView(await api<View>(`/abdm/reports/${id}/workspace`));
  }
  async function initialize() {
    setBusy(true); setError("");
    try {
      const c = await api<AuthConfiguration>("/auth/config"); setConfig(c);
      if (c.provider === "demo") await post("/demo/session");
      const data = await api<{ reports: Report[] }>("/abdm/dataset"); setReports(data.reports); setLogin(false);
      if (data.reports[0]) await select(data.reports[0].reportId);
    } catch (e) { if (e instanceof ApiError && [401, 403].includes(e.status)) setLogin(true); else setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (!initialized.current) { initialized.current = true; void initialize(); } return () => { recorder.current?.stop(); }; }, []);
  async function consent(action: string) {
    if (!view) return; epoch.current++; setAnswer(null); setDraft(""); setBusy(true); setError("");
    try { setView(await post<View>(`/abdm/reports/${view.reportId}/consent/${action}`)); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function ask(payload: object, voice = false) {
    if (!view) return; const current = epoch.current; setBusy(true); setError("");
    try {
      const result = await post<Answer>(`/abdm/reports/${view.reportId}/${voice ? "voice" : "chat"}`, payload);
      if (epoch.current !== current) return;
      setAnswer(result); setDraft(result.answer);
      if (result.transcript) setQuestion(result.transcript);
      if (result.audioBase64) await new Audio(`data:${result.audioContentType};base64,${result.audioBase64}`).play();
    } catch (e) { if (epoch.current === current) setError((e as Error).message); } finally { setBusy(false); }
  }
  async function record() {
    if (recording) { recorder.current?.stop(); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      const context = new AudioContext(); const source = context.createMediaStreamSource(media); const processor = context.createScriptProcessor(4096, 1, 1); const mute = context.createGain(); mute.gain.value = 0;
      const chunks: Float32Array[] = []; source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      processor.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      let stopped = false;
      const stop = () => {
        if (stopped) return; stopped = true; clearTimeout(timer); processor.disconnect(); source.disconnect(); mute.disconnect(); media.getTracks().forEach(t => t.stop()); setRecording(false);
        const length = chunks.reduce((n,c) => n+c.length,0); const input = new Float32Array(length); let at = 0; for (const c of chunks) { input.set(c,at); at+=c.length; }
        const ratio = context.sampleRate / 16000; const pcm = new Int16Array(Math.floor(length/ratio));
        for(let i=0;i<pcm.length;i++) { const value = Math.max(-1,Math.min(1,input[Math.floor(i*ratio)])); pcm[i]=Math.round(value*(value<0?32768:32767)); }
        void context.close(); const bytes = new Uint8Array(pcm.buffer); let binary=""; for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        if (pcm.length) void ask({ audioBase64:btoa(binary),sampleRate:16000 },true);
      };
      const timer = setTimeout(stop,20000); recorder.current={stop}; setRecording(true);
    } catch(e) { setError((e as Error).message); }
  }
  async function approve() {
    if(!view)return; setBusy(true); setError("");
    try { setView(await post<View>(`/abdm/reports/${view.reportId}/approve`,{text:draft,sourceVersion:view.sourceVersion})); }
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  if (login && config) return <AuthForm configuration={config} initialError={error} onSignedIn={initialize} onRetry={() => void initialize()}/>;
  return <main className="abdm-app"><nav><Link href="/">Zuma / Clinical workspace</Link><Link href="/setup">Setup ↗</Link><a href="/deployment/abdm/render-guide.html">Deployment guide ↗</a></nav><header><span className="abdm-label">NHA REPOSITORY · EVIDENCE REVIEW</span><h1>Source first.<br/>Doctor approved.</h1><p>Two test hospitals. Two distinct patients. Source identities and partial dates are preserved.</p></header>{error&&<div className="abdm-error" role="alert">{error}<button onClick={()=>void initialize()}>Reconnect</button></div>}<div className="abdm-selector">{reports.map(r=><button className={view?.reportId===r.reportId?"selected":""} key={r.reportId} disabled={busy||recording} onClick={()=>void select(r.reportId).catch(e=>setError(e.message))}>Hospital {r.hospitalId} <strong>{r.name}</strong><small>Birth date: {r.birthDate}</small></button>)}</div>{busy&&!view&&<p>Connecting to the clinical service…</p>}{view&&<><section className="abdm-permission"><div><strong>{view.allowed?"Report access permitted":"Report access requires permission"}</strong><p>Recipient: your Hospital B doctor · Purpose: treatment · Scope: this report only. Grant is simulated for this demonstration.</p>{view.allowed&&<small>Expires: {new Date(view.consent.expiresAt).toLocaleString()}</small>}</div><button disabled={busy||recording} onClick={()=>void consent(view.allowed?"revoke":"grant")}>{view.allowed?"Revoke access":"Grant demo permission"}</button></section><div className="abdm-grid"><section><h2>Patient & source</h2><p><strong>{view.name}</strong><br/>Patient ID: {view.patientId}<br/>Birth date as recorded: {view.birthDate}</p><a href={view.sourceUrl} target="_blank" rel="noreferrer">Inspect pinned GitHub source ↗</a>{view.findings.map(f=><aside key={f.title}><strong>{f.title}</strong><p>{f.detail}</p></aside>)}{view.bundle&&<details><summary>{view.bundle.entry.length} original FHIR resources</summary><pre>{JSON.stringify(view.bundle,null,2)}</pre></details>}</section><section><h2>Ask the evidence</h2><p>Bedrock retrieval → patient/source checks → exact source facts. No predictions or treatment recommendations.</p><textarea aria-label="Question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What allergy information is documented?" disabled={!view.allowed||busy}/><div className="abdm-actions"><button disabled={!view.allowed||busy||!question.trim()||recording} onClick={()=>void ask({question})}>{busy?"Retrieving…":"Ask by text"}</button><button disabled={!view.allowed||busy} onClick={()=>void record()}>{recording?"Stop and send":"Ask Nova by voice"}</button></div><small>Voice: microphone permission; up to 20 seconds. Nova transcribes; Polly reads the evidence-backed text.</small>{answer&&<><div className="abdm-answer">{answer.answer}</div><p>{answer.warning}</p>{answer.citations.map(c=><details key={c.id}><summary>{c.title} · source evidence</summary><p>{c.quote}</p><a href={c.sourceUrl} target="_blank" rel="noreferrer">Original report ↗</a></details>)}</>}</section><section><h2>Review & release</h2><p>Edit the draft, inspect its sources, then approve it for the current permission and source version.</p><textarea aria-label="Review draft" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Your evidence-backed draft appears here." disabled={!view.allowed||busy}/><button disabled={!view.allowed||busy||!draft.trim()||recording} onClick={()=>void approve()}>Approve draft</button>{view.approval&&<div className="abdm-actions"><a href={`/api/abdm/reports/${view.reportId}/export?format=html`}>Download readable report</a><a href={`/api/abdm/reports/${view.reportId}/export?format=fhir`}>Download FHIR package</a></div>}<p>Original FHIR is preserved. Terminology and official HL7/ABDM profile validation remain review requirements.</p><h3>Audit trail</h3>{view.audit.slice(0,8).map(a=><p key={a.id}><strong>{a.action.replaceAll("_"," ")}</strong><br/><small>{a.actor} · {new Date(a.at).toLocaleString()}</small></p>)}</section></div><footer>{view.notice}</footer></>}</main>;
}
