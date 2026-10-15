"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, FileText, Layers3, Mic, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { api, post } from "../src/lib/api";
import type { Bootstrap, Workspace } from "../shared/types";
import "./landing.css";

const EvidenceGraph = dynamic(() => import("./EvidenceGraph"), { ssr: false, loading: () => <div className="lp-graph-loading">Preparing the evidence view…</div> });
const features = [
  { title: "Different formats. Shared meaning.", name: "Connect", body: "One hospital writes ‘Hb’. Another writes ‘Haemoglobin’. Reviewed mappings bring supported records into a common FHIR format. Unknown terms are flagged, never guessed.", icon: Layers3 },
  { title: "The right Ravi. Every time.", name: "Match", body: "Two people can share a name. Compare patient identifiers and demographic evidence before connecting their histories. A person reviews uncertain matches.", icon: FileText },
  { title: "Permission travels with the question.", name: "Protect", body: "Ravi can allow selected reports for treatment. The same permission does not give an insurer his full history. The backend checks the recipient, purpose, record types and expiry.", icon: ShieldCheck },
  { title: "A summary with the receipts.", name: "Understand", body: "Read documented conditions, medicines, allergies and results together. Every factual item keeps its source and date, with missing hospital records clearly identified.", icon: Sparkles },
  { title: "See the change. Keep the context.", name: "Compare", body: "Inspect comparable results across visits. See when allergy statements disagree. The workspace keeps both sources visible until an authorized person resolves the question.", icon: Layers3 },
  { title: "Ask it your way.", name: "Converse", body: "Type a question or use supported browser speech. Answers use the same permitted evidence. Source links stay on screen while an answer is read aloud.", icon: Mic },
  { title: "The last word belongs to the doctor.", name: "Review", body: "Review and edit the draft before approving it. Export a readable summary or a structured FHIR document after current permission and supported structure checks.", icon: Check },
];
const faq = [
  { q: "Are these real patient records?", a: "No. This prototype uses fictional patients and two simulated hospital systems. The preview is loaded from the running application API, and is labelled synthetic throughout." },
  { q: "Is a cloud AI model already connected?", a: "The default assistant is a local evidence engine. An optional Amazon Bedrock adapter can be explicitly configured. S3 and Supabase are not connected by default, and browser speech is not Amazon Nova Sonic." },
  { q: "Can it decide which medical record is correct?", a: "It highlights disagreements and shows their sources. It does not diagnose, recommend a treatment, or automatically decide which conflicting clinical statement is correct." },
  { q: "Is this ready for a live hospital?", a: "This is a synthetic prototype. Demo sessions are not production authentication, and local FHIR checks are not full ABDM certification. Real identity, hospital integrations and production controls need separate implementation." },
];

export default function Landing() {
  const [feature, setFeature] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const source = workspace?.citations.find((item) => item.id === selectedCitation);
  const ActiveIcon = features[feature].icon;

  useEffect(() => {
    if (reduced !== false) return;
    let stopped = false;
    let revert: (() => void) | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([module, plugin]) => {
      if (stopped || !root.current) return;
      const gsap = module.gsap;
      gsap.registerPlugin(plugin.ScrollTrigger);
      const media = gsap.matchMedia();
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".lp-reveal").forEach((element) => {
          gsap.fromTo(element, { y: 22 }, { y: 0, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 91%", once: true } });
        });
        media.add("(min-width: 1100px) and (prefers-reduced-motion: no-preference)", () => {
          plugin.ScrollTrigger.create({ trigger: ".lp-workflow", start: "top 110px", end: "bottom bottom", pin: ".lp-workflow-intro", pinSpacing: false });
        });
      }, root);
      revert = () => { media.revert(); context.revert(); };
    }).catch(() => {});
    return () => { stopped = true; revert?.(); };
  }, [reduced]);

  async function loadPreview() {
    setBusy(true); setError(""); setSelectedCitation(null);
    try {
      const config = await api<{ provider: string }>("/auth/config");
      if (config.provider === "demo") await post<Bootstrap>("/demo/session");
      const bootstrap = await api<Bootstrap>("/bootstrap");
      const patient = bootstrap.patients.find((item) => item.id === "ravi") ?? bootstrap.patients[0];
      if (!patient) throw new Error("No synthetic patients are available.");
      const result = await api<Workspace>(`/patients/${patient.id}/workspace`);
      setWorkspace(result);
    } catch (reason) { setWorkspace(null); setError(reason instanceof Error ? reason.message : "The preview could not be loaded. Open the workspace to check the connection."); }
    finally { setBusy(false); }
  }

  return <div className="landing lp" ref={root}>
    <header className="lp-header">
      <Link href="/" className="lp-logo" aria-label="Clinical workspace home"><span className="lp-logo-mark"><Plus size={23} strokeWidth={3} /></span><span>Clinical<br />workspace</span></Link>
      <button className="lp-menu" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Toggle navigation">{menu ? <X /> : <span>Menu <Plus size={16} /></span>}</button>
      <nav className={menu ? "lp-nav lp-nav-open" : "lp-nav"} aria-label="Main navigation"><a href="#features" onClick={() => setMenu(false)}>The features</a><a href="#workflow" onClick={() => setMenu(false)}>How it works</a><a href="#privacy" onClick={() => setMenu(false)}>Built with care</a><Link href="/setup">Setup</Link><Link href="/abdm">ABDM mock</Link></nav>
      <Link className="lp-nav-cta" href="/abdm">Enter workspace <ArrowUpRight size={17} /></Link>
    </header>

    <main>
      <section className="lp-hero">
        <div className="lp-hero-copy"><div className="lp-eyebrow"><span /> A clearer handoff starts here</div><h1>Every record.<br />One clear<br /><span>picture.</span><i className="lp-spark" aria-hidden="true">✳</i></h1><p>Different hospitals. Different histories. Bring the evidence together, so doctors can see what matters—and where it came from.</p><div className="lp-hero-actions"><Link className="lp-button" href="/abdm">Open clinical workspace <ArrowUpRight size={22} /></Link><a className="lp-text-link" href="#workflow">Explore the workflow <ArrowDown size={17} /></a></div><div className="lp-hero-note">made for the humans<br />behind the records <span aria-hidden="true">↗</span></div></div>
        <div className="lp-hero-art" aria-label="Connect, understand and review patient records">
          <svg className="lp-orbits" viewBox="0 0 600 620" aria-hidden="true"><ellipse cx="300" cy="315" rx="270" ry="150" transform="rotate(-28 300 315)" /><ellipse cx="300" cy="315" rx="265" ry="160" transform="rotate(45 300 315)" /><circle cx="300" cy="315" r="230" /></svg>
          <motion.div className="lp-float-card lp-connect" initial={false} whileHover={reduced ? {} : { rotate: -3, y: -8 }}><span className="lp-card-index">01 / CONNECT</span><Layers3 size={34} strokeWidth={1.7} /><strong>Two hospitals.<br />One patient.</strong><span>Keep the source. Connect the story.</span></motion.div>
          <div className="lp-guide"><img src="/care-guide.png" alt="A friendly original guide holding a clinical document" width="220" height="260" /></div>
          <motion.div className="lp-float-card lp-understand" initial={false} whileHover={reduced ? {} : { rotate: 1, y: -8 }}><span className="lp-card-index">02 / UNDERSTAND</span><div className="lp-mini-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div><strong>Less searching.<br />More context.</strong><span>Every finding, connected to evidence.</span></motion.div>
          <motion.div className="lp-float-card lp-review" initial={false} whileHover={reduced ? {} : { rotate: 0, y: -5 }}><Check size={21} /><div><strong>A doctor has the final word.</strong><span>Review before release.</span></div></motion.div>
          <span className="lp-art-caption">A little order. A lot more clarity.</span>
        </div>
      </section>

      <div className="lp-principles"><span><FileText size={18} /> Source-linked records</span><span><ShieldCheck size={18} /> Permission before retrieval</span><span><Mic size={18} /> Voice & text, one workflow</span><span className="lp-demo-tag">Synthetic prototype · PS-013</span></div>

      <section className="lp-workflow" id="workflow">
        <div className="lp-workflow-intro"><div className="lp-eyebrow">THE WORKFLOW / 01</div><h2>Good care needs<br />a shared story.</h2><p>Records can travel between hospitals and still leave questions behind. Start with identity. Keep the evidence. Make uncertainty visible.</p><Link className="lp-button lp-button-white" href="/abdm">See it in action <ArrowUpRight size={22} /></Link></div>
        <div className="lp-steps"><article className="lp-step lp-reveal"><span>01</span><div><h3>Connect the right records.</h3><p>Confirm who the patient is, map supported formats, and check what the receiving doctor is allowed to see.</p><div className="lp-step-pills"><span>Hospital A</span><ArrowRight size={18} /><span>Patient match</span><ArrowRight size={18} /><span>Hospital B</span></div></div></article><article className="lp-step lp-reveal"><span>02</span><div><h3>Understand what&apos;s there.<br />And what isn&apos;t.</h3><p>A source-linked summary brings the available history together. Changes, missing reports and conflicting statements stay visible.</p><div className="lp-step-note"><span /> Two allergy statements disagree. Review both sources.</div></div></article><article className="lp-step lp-reveal"><span>03</span><div><h3>Ask. Review. Move forward.</h3><p>Ask a focused question by text or supported speech. Review the draft and approve a structured summary before sharing.</p><span className="lp-step-approved"><Check size={16} /> The clinician stays in control</span></div></article></div>
      </section>

      <section className="lp-preview-section" id="preview"><div className="lp-section-heading lp-reveal"><div><div className="lp-eyebrow">A REAL LOOK / SYNTHETIC DATA</div><h2>No mystery behind<br />the summary.</h2></div><p>Open a preview from the running application. See the records this session can actually access—without a made-up success screen.</p></div><div className="lp-preview-shell"><div className="lp-preview-sidebar"><span className="lp-small-label">PATIENT OVERVIEW</span><div className="lp-patient-initials">{workspace?.patient.initials ?? "?"}</div><h3>{workspace?.patient.name ?? "Meet the workflow."}</h3><p>{workspace ? "Fictional patient · permitted evidence only" : "Load a fictional patient from the local demonstration."}</p><button className="lp-button lp-preview-button" onClick={loadPreview} disabled={busy}>{busy ? "Loading evidence…" : workspace ? "Refresh preview" : "Load synthetic preview"}<ArrowUpRight size={18} /></button><span className="lp-preview-fineprint">This action starts or reuses a synthetic demo session.</span></div><div className="lp-preview-content" aria-live="polite">{error ? <div className="lp-preview-empty"><ShieldCheck size={32} /><h3>That preview isn&apos;t available.</h3><p>{error}</p><Link href="/abdm" className="lp-text-link">Open the workspace <ArrowRight size={16} /></Link></div> : !workspace ? <div className="lp-preview-empty"><FileText size={40} strokeWidth={1.2} /><h3>Real evidence.<br />Fictional patient.</h3><p>Source coverage, summary items and citations appear here after you load the preview.</p><span className="lp-outline-tag">No clinical data loaded</span></div> : <><div className="lp-preview-top"><span className="lp-outline-tag">Synthetic draft</span><span>{workspace.records.length} permitted records</span></div><h3>What the available records say.</h3><p className="lp-coverage">{workspace.summary?.coverage ?? workspace.access.reason}</p><div className="lp-source-chips">{workspace.hospitals.map((hospital) => <span key={hospital.id}><i className={hospital.status === "connected" ? "" : "lp-status-unavailable"} />{hospital.name} · {hospital.recordCount} records</span>)}</div>{workspace.summary?.sections.slice(0, 3).map((section) => <div className="lp-summary-section" key={section.title}><h4>{section.title}</h4>{section.items.slice(0, 2).map((item, index) => <p key={index}>{item.text} <span className="lp-citation-buttons">{item.citationIds.map((id) => <button key={id} onClick={() => setSelectedCitation(selectedCitation === id ? null : id)} aria-label={`Inspect evidence ${id}`} aria-pressed={id === selectedCitation}><FileText size={11} /> Source</button>)}</span></p>)}</div>)}{!workspace.summary && <p>The current permission or patient match does not provide a summary. Continue in the workspace to review it.</p>}{source && <aside className="lp-selected-source"><strong>{source.title}</strong><span>{source.hospital} · {source.date}</span><p>{source.quote}</p></aside>}<Link href="/abdm" className="lp-text-link">Inspect the complete history <ArrowUpRight size={17} /></Link></>}</div></div></section>

      <section className="lp-features" id="features"><div className="lp-section-heading lp-reveal"><div><div className="lp-eyebrow">THE TOOLKIT / 02</div><h2>Seven features.<br />One connected flow.</h2></div><p>Useful at the moment a doctor needs the next piece of the story.</p></div><div className="lp-feature-layout"><div className="lp-feature-visual"><span className="lp-card-index">{String(feature + 1).padStart(2, "0")} / {features[feature].name.toUpperCase()}</span><ActiveIcon size={78} strokeWidth={1.15} /><h3>{features[feature].name}<span>the story.</span></h3><div className="lp-visual-rule" /><p>Evidence first.<br />The doctor always in control.</p></div><div className="lp-accordion">{features.map((item, index) => <article key={item.name} className={feature === index ? "lp-feature-item lp-feature-active" : "lp-feature-item"}><h3><button aria-expanded={feature === index} aria-controls={`lp-feature-${index}`} onClick={() => setFeature(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}<Plus className={feature === index ? "lp-plus-active" : ""} size={20} /></button></h3><div id={`lp-feature-${index}`} hidden={feature !== index}><p>{item.body}</p><Link href="/abdm">Try it in the workspace <ArrowUpRight size={15} /></Link></div></article>)}</div></div></section>

      <section className="lp-provenance" id="evidence"><div className="lp-provenance-copy lp-reveal"><div className="lp-eyebrow">FOLLOW THE EVIDENCE / 03</div><h2>Nothing floats<br />without a source.</h2><p>Follow the relationship between a patient, the hospitals and the records this session is permitted to see. Select a node to explore its connections.</p><div className="lp-graph-legend"><span><i /> Patient</span><span><i /> Hospital</span><span><i /> Record</span></div>{!workspace && <button className="lp-button" onClick={loadPreview} disabled={busy}>{busy ? "Loading…" : "Load the evidence graph"}<ArrowUpRight size={18} /></button>}<span className="lp-dark-note">Explicit provenance links, not a diagnostic model.</span></div><div className="lp-provenance-graph">{workspace ? <EvidenceGraph graph={workspace.graph} reducedMotion={reduced === true} colors={{ background: "#111111", patient: "#FFD84D", hospital: "#FFFFFF", record: "#FF5B3E", edge: "#787878", text: "#FFFFFF" }} /> : <div className="lp-graph-placeholder"><div className="lp-graph-symbol" aria-hidden="true"><span /><span /><span /><span /><span /></div><p>Only currently permitted evidence<br />will appear here.</p><span>Load the synthetic preview to begin.</span></div>}</div></section>

      <section className="lp-privacy" id="privacy"><div className="lp-privacy-heading"><ShieldCheck size={40} strokeWidth={1.4} /><h2>Built with care.<br />Clear about its limits.</h2></div><div className="lp-privacy-grid"><article><h3>Permission before access.</h3><p>Server-side checks protect the demonstration workflow. Revocation blocks subsequent retrieval; it cannot undo a previous download.</p></article><article><h3>Uncertainty stays visible.</h3><p>Missing records and contradictory statements remain explicit. A summary never claims to include a hospital that could not be reached.</p></article><article><h3>A prototype, honestly.</h3><p>Synthetic records, demo sessions and local FHIR structure checks. No claim of production authentication or ABDM certification.</p></article></div></section>

      <section className="lp-faq"><div><div className="lp-eyebrow">A FEW GOOD QUESTIONS</div><h2>Clarity starts<br />with honesty.</h2><span className="lp-handwritten">no fine-print surprises.</span></div><div>{faq.map((item) => <details key={item.q}><summary>{item.q}<Plus size={18} /></summary><p>{item.a}</p></details>)}</div></section>

      <section className="lp-final"><span className="lp-eyebrow">LESS FRAGMENTATION. MORE UNDERSTANDING.</span><h2>Let&apos;s connect<br />the whole story<span>✳</span></h2><Link href="/abdm" className="lp-button lp-button-white">Open clinical workspace <ArrowUpRight size={23} /></Link><p>Explore with fictional patients. Keep the human in control.</p></section>
    </main>
    <footer className="lp-footer"><Link href="/" className="lp-logo"><span className="lp-logo-mark"><Plus size={22} strokeWidth={3} /></span><span>Clinical<br />workspace</span></Link><p>Healthcare interoperability, with evidence.<br /><span>Synthetic prototype · PS-013 · Product name to be decided</span></p><a href="#privacy">Privacy & prototype scope <ArrowUpRight size={15} /></a></footer>
  </div>;
}
