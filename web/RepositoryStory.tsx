"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileJson, ShieldCheck } from "lucide-react";

export type PublicReport = { id: string; name: string; birthDate: string; hospital: string; date: string; source: string; count: number; resources: { id: string; type: string; label: string; value: string; date: string }[] };
export default function RepositoryStory({ reports, graph = false }: { reports: PublicReport[]; graph?: boolean }) {
  const [selected, setSelected] = useState(reports[0]?.id);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const report = reports.find(r => r.id === selected) ?? reports[0];
  if (!report) return <p>The public source catalog is unavailable. <Link href="/workspace">Open Zuma</Link> to check permitted records.</p>;
  const resource = report.resources.find(r => r.id === resourceId) ?? report.resources[0];
  const target = `/workspace?report=${report.id}`;
  const choose = (id: string) => { setSelected(id); setResourceId(null); };
  return <div className={graph ? "lp-resource-story lp-resource-story-dark" : "lp-resource-story"}>
    <div className="lp-repository-tabs" role="group" aria-label="Public sample patient">{reports.map(r => <button key={r.id} aria-pressed={r.id === selected} onClick={() => choose(r.id)}><small>Hospital {r.hospital} · test assignment</small><strong>{r.name}</strong></button>)}</div>
    {graph ? <><div className="lp-source-flow" aria-label="Source relationships">
      <a href={report.source} target="_blank" rel="noreferrer"><span className="lp-flow-dot"/><small>FHIR PATIENT</small><strong>{report.name}</strong><span>Birth date: {report.birthDate}</span><FileJson size={17}/></a>
      <ArrowRight className="lp-flow-arrow" aria-hidden="true"/>
      <a href={report.source} target="_blank" rel="noreferrer"><span className="lp-flow-dot lp-flow-document"/><small>SOURCE DOCUMENT</small><strong>{report.count} FHIR resources</strong><span>Clinical date: {report.date}</span><ArrowUpRight size={17}/></a>
      <ArrowRight className="lp-flow-arrow" aria-hidden="true"/>
      <Link href={target}><ShieldCheck size={24}/><small>ZUMA WORKSPACE</small><strong>Permission → review</strong><span>Ask · inspect · approve</span><ArrowUpRight size={17}/></Link>
    </div><div className="lp-resource-trail"><strong>Follow a clinical resource</strong>{report.resources.map(r => <button key={r.id} aria-pressed={resource?.id === r.id} onClick={() => setResourceId(r.id)}>{r.type}<span>{r.label}</span></button>)}</div>{resource&&<div className="lp-resource-selected"><strong>{resource.label}</strong><p>{resource.value}</p><code>{resource.type}/{resource.id}</code><a href={report.source} target="_blank" rel="noreferrer">Inspect original FHIR document <ArrowUpRight size={14}/></a></div>}<p className="lp-public-note">These are explicit document relationships, not a diagnosis or a link between different patients.</p></> : <div className="lp-repository-preview"><aside><span className="lp-small-label">PUBLIC SOURCE PATIENT</span><div className="lp-patient-initials">{report.name.split(/\s+/).map(n=>n[0]).slice(0,2).join("")}</div><h3>{report.name}</h3><p>Birth date as recorded: <strong>{report.birthDate}</strong></p><p>{report.count} original FHIR resources<br/>Clinical date: {report.date}</p><Link href={target} className="lp-button lp-button-white">Review in Zuma <ArrowUpRight size={18}/></Link><small>Sign in, check identity and grant report permission before asking.</small></aside><div><span className="lp-outline-tag">Public repository excerpt · original source wording</span><h3>Clinical data, with its source.</h3><p>This excerpt comes from the published NHA sample FHIR document. It is not a live hospital record or an AI-generated assessment.</p><div className="lp-public-records">{report.resources.slice(0,4).map(r=><article key={r.id}><span>{r.type}</span><h4>{r.label}</h4><p>{r.value}</p><a href={report.source} target="_blank" rel="noreferrer">Source: {r.type}/{r.id} <ArrowUpRight size={13}/></a></article>)}</div><Link href={target} className="lp-text-link">Open this patient in Zuma <ArrowRight size={16}/></Link></div></div>}
  </div>;
}
