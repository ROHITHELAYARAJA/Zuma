"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, FileText, Layers3, Mic, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import RepositoryStory, { type PublicReport } from "./RepositoryStory";
import "./landing.css";
import "./repository-story.css";

const features = [
  { title: "Different formats. Shared meaning.", name: "Connect", body: "One hospital writes ‘Hb’. Another writes ‘Haemoglobin’. Reviewed mappings bring supported records into a common FHIR format. Unknown terms are flagged, never guessed.", icon: Layers3 },
  { title: "The right record. Identity first.", name: "Match", body: "Two people can share a name. Compare patient identifiers and demographic evidence before connecting their histories. A person reviews uncertain matches.", icon: FileText },
  { title: "Permission travels with the question.", name: "Protect", body: "Report permission is scoped to the treating doctor and expires. A grant never provides an insurer with a complete history. This prototype uses explicit demonstration grants.", icon: ShieldCheck },
  { title: "A summary with the receipts.", name: "Understand", body: "Read documented conditions, medicines, allergies and results together. Every factual item keeps its source and date, with missing hospital records clearly identified.", icon: Sparkles },
  { title: "See the change. Keep the context.", name: "Compare", body: "Inspect comparable results across visits. See when allergy statements disagree. The workspace keeps both sources visible until an authorized person resolves the question.", icon: Layers3 },
  { title: "Ask it your way.", name: "Converse", body: "Type a question or record it by voice. Answers use the same permitted evidence. Source links stay on screen while an answer is read aloud.", icon: Mic },
  { title: "The last word belongs to the doctor.", name: "Review", body: "Review and edit the draft before approving it. Export the reviewed narrative and original FHIR package after permission and source checks. Official FHIR profile validation remains pending.", icon: Check },
];
const faq = [
  { q: "Are these real patient records?", a: "The homepage shows public sample FHIR documents from the NHA repository. Venu Ajitesh and Sonu Kumar are different source patients. No live hospital feed is connected." },
  { q: "Where do answers come from?", a: "Zuma retrieves evidence from the configured hosted knowledge service for the permitted patient and report. Draft claims are checked against supporting sources. It does not substitute a local answer if the service is unavailable." },
  { q: "Can it decide which medical record is correct?", a: "It highlights disagreements and shows their sources. It does not diagnose, recommend a treatment, or automatically decide which conflicting clinical statement is correct." },
  { q: "Is this ready for a live hospital?", a: "Clinician sign-in and report access checks are implemented. Official sandbox approval, live hospital connectors, patient-issued consent and external FHIR profile validation remain integration requirements." },
];

export default function Landing({ reports }: { reports: PublicReport[] }) {
  const [feature, setFeature] = useState(0);
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
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
          gsap.fromTo(element, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.75, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 91%", once: true } });
        });
        gsap.fromTo(".lp-hero-copy > *", { y: 18, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: ".lp-hero", start: "top 78%", once: true },
        });
        gsap.to(".lp-hero-art", {
          y: 70,
          scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1 },
        });
        gsap.to(".lp-guide", {
          y: -42,
          rotate: -3,
          ease: "none",
          scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1.2 },
        });
        gsap.to(".lp-connect", {
          y: -34,
          rotate: 13,
          ease: "none",
          scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1 },
        });
        gsap.to(".lp-understand", {
          y: 28,
          rotate: -6,
          ease: "none",
          scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1.3 },
        });
        gsap.to(".lp-review", {
          y: -18,
          rotate: 1,
          ease: "none",
          scrollTrigger: { trigger: ".lp-hero", start: "top top", end: "bottom top", scrub: 1.1 },
        });
        gsap.fromTo(".lp-principles > span", { y: 16, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.55,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: ".lp-principles", start: "top 88%", once: true },
        });
        gsap.fromTo(".lp-step", { x: 28, autoAlpha: 0 }, {
          x: 0,
          autoAlpha: 1,
          duration: 0.7,
          stagger: 0.16,
          ease: "power2.out",
          scrollTrigger: { trigger: ".lp-steps", start: "top 82%", once: true },
        });
        gsap.to(".lp-feature-visual", {
          y: -24,
          rotate: 1.5,
          ease: "none",
          scrollTrigger: { trigger: ".lp-features", start: "top bottom", end: "bottom top", scrub: 1 },
        });
        gsap.fromTo(".lp-feature-item", { y: 18, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: ".lp-accordion", start: "top 83%", once: true },
        });
        gsap.fromTo(".lp-provenance-copy > *", { y: 22, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.65,
          stagger: 0.09,
          ease: "power2.out",
          scrollTrigger: { trigger: ".lp-provenance", start: "top 82%", once: true },
        });
        media.add("(min-width: 1100px) and (prefers-reduced-motion: no-preference)", () => {
          plugin.ScrollTrigger.create({ trigger: ".lp-workflow", start: "top 110px", end: "bottom bottom", pin: ".lp-workflow-intro", pinSpacing: false });
        });
      }, root);
      revert = () => { media.revert(); context.revert(); };
    }).catch((reason) => console.error("Landing animations could not be initialized.", reason));
    return () => { stopped = true; revert?.(); };
  }, [reduced]);

  return <div className="landing lp" ref={root}>
    <header className="lp-header">
      <Link href="/" className="lp-logo" aria-label="Zuma home"><span className="lp-logo-mark"><Plus size={23} strokeWidth={3} /></span><span>Zuma</span></Link>
      <button className="lp-menu" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Toggle navigation">{menu ? <X /> : <span>Menu <Plus size={16} /></span>}</button>
      <nav className={menu ? "lp-nav lp-nav-open" : "lp-nav"} aria-label="Main navigation"><a href="#features" onClick={() => setMenu(false)}>The features</a><a href="#workflow" onClick={() => setMenu(false)}>How it works</a><a href="#privacy" onClick={() => setMenu(false)}>Built with care</a><Link href="/setup">Setup</Link><a href="#evidence">Source explorer</a></nav>
      <Link className="lp-nav-cta" href="/workspace">Enter workspace <ArrowUpRight size={17} /></Link>
    </header>

    <main>
      <section className="lp-hero">
        <div className="lp-hero-copy"><div className="lp-eyebrow"><span /> A clearer handoff starts here</div><h1>Every record.<br />One clear<br /><span>picture.</span><i className="lp-spark" aria-hidden="true">✳</i></h1><p>Different hospitals. Different histories. Bring the evidence together, so doctors can see what matters—and where it came from.</p><div className="lp-hero-actions"><Link className="lp-button" href="/workspace">Open Zuma workspace <ArrowUpRight size={22} /></Link><a className="lp-text-link" href="#workflow">Explore the workflow <ArrowDown size={17} /></a></div><div className="lp-hero-note">made for the humans<br />behind the records <span aria-hidden="true">↗</span></div></div>
        <div className="lp-hero-art" aria-label="Connect, understand and review patient records">
          <svg className="lp-orbits" viewBox="0 0 600 620" aria-hidden="true"><ellipse cx="300" cy="315" rx="270" ry="150" transform="rotate(-28 300 315)" /><ellipse cx="300" cy="315" rx="265" ry="160" transform="rotate(45 300 315)" /><circle cx="300" cy="315" r="230" /></svg>
          <motion.div className="lp-float-card lp-connect" initial={false} whileHover={reduced ? {} : { rotate: -3, y: -8 }}><span className="lp-card-index">01 / CONNECT</span><Layers3 size={34} strokeWidth={1.7} /><strong>Two sources.<br />Clear boundaries.</strong><span>Keep the source. Connect the story.</span></motion.div>
          <div className="lp-guide"><img src="/care-guide.png" alt="A friendly original guide holding a clinical document" width="220" height="260" /></div>
          <motion.div className="lp-float-card lp-understand" initial={false} whileHover={reduced ? {} : { rotate: 1, y: -8 }}><span className="lp-card-index">02 / UNDERSTAND</span><div className="lp-mini-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div><strong>Less searching.<br />More context.</strong><span>Every finding, connected to evidence.</span></motion.div>
          <motion.div className="lp-float-card lp-review" initial={false} whileHover={reduced ? {} : { rotate: 0, y: -5 }}><Check size={21} /><div><strong>A doctor has the final word.</strong><span>Review before release.</span></div></motion.div>
          <span className="lp-art-caption">A little order. A lot more clarity.</span>
        </div>
      </section>

      <div className="lp-principles"><span><FileText size={18} /> Source-linked records</span><span><ShieldCheck size={18} /> Permission before retrieval</span><span><Mic size={18} /> Voice & text, one workflow</span><span className="lp-demo-tag">Repository sample prototype · PS-013</span></div>

      <section className="lp-workflow" id="workflow">
        <div className="lp-workflow-intro"><div className="lp-eyebrow">THE WORKFLOW / 01</div><h2>Good care needs<br />a shared story.</h2><p>Records can travel between hospitals and still leave questions behind. Start with identity. Keep the evidence. Make uncertainty visible.</p><Link className="lp-button lp-button-white" href="/workspace">See it in action <ArrowUpRight size={22} /></Link></div>
        <div className="lp-steps"><article className="lp-step lp-reveal"><span>01</span><div><h3>Connect the right records.</h3><p>Confirm who the patient is, map supported formats, and check what the receiving doctor is allowed to see.</p><div className="lp-step-pills"><span>Hospital A</span><ArrowRight size={18} /><span>Patient match</span><ArrowRight size={18} /><span>Hospital B</span></div></div></article><article className="lp-step lp-reveal"><span>02</span><div><h3>Understand what&apos;s there.<br />And what isn&apos;t.</h3><p>A source-linked summary brings the available history together. Changes, missing reports and conflicting statements stay visible.</p><div className="lp-step-note"><span /> Source terminology needs review. Keep the original wording visible.</div></div></article><article className="lp-step lp-reveal"><span>03</span><div><h3>Ask. Review. Move forward.</h3><p>Ask a focused question by text or supported speech. Review the draft and approve a structured summary before sharing.</p><span className="lp-step-approved"><Check size={16} /> The clinician stays in control</span></div></article></div>
      </section>

      <section className="lp-preview-section" id="preview"><div className="lp-section-heading lp-reveal"><div><div className="lp-eyebrow">PUBLIC NHA SAMPLE RECORDS</div><h2>No mystery behind<br/>the record.</h2></div><p>Two published sample patients. Original clinical fields and direct source links. Choose a patient, then continue into the protected Zuma workspace.</p></div><RepositoryStory reports={reports}/></section>

      <section className="lp-features" id="features"><div className="lp-section-heading lp-reveal"><div><div className="lp-eyebrow">THE TOOLKIT / 02</div><h2>Seven features.<br />One connected flow.</h2></div><p>Useful at the moment a doctor needs the next piece of the story.</p></div><div className="lp-feature-layout"><div className="lp-feature-visual"><span className="lp-card-index">{String(feature + 1).padStart(2, "0")} / {features[feature].name.toUpperCase()}</span><ActiveIcon size={78} strokeWidth={1.15} /><h3>{features[feature].name}<span>the story.</span></h3><div className="lp-visual-rule" /><p>Evidence first.<br />The doctor always in control.</p></div><div className="lp-accordion">{features.map((item, index) => <article key={item.name} className={feature === index ? "lp-feature-item lp-feature-active" : "lp-feature-item"}><h3><button aria-expanded={feature === index} aria-controls={`lp-feature-${index}`} onClick={() => setFeature(index)}><span>{String(index + 1).padStart(2, "0")}</span>{item.title}<Plus className={feature === index ? "lp-plus-active" : ""} size={20} /></button></h3><div id={`lp-feature-${index}`} hidden={feature !== index}><p>{item.body}</p><Link href="/workspace">Try it in the workspace <ArrowUpRight size={15} /></Link></div></article>)}</div></div></section>

      <section className="lp-provenance" id="evidence"><div className="lp-provenance-copy lp-reveal"><div className="lp-eyebrow">FOLLOW THE EVIDENCE / 03</div><h2>Nothing floats<br/>without a source.</h2><p>A patient identity belongs to a source document. Each clinical resource stays attached to that document. Zuma checks permission before using it in an answer.</p><div className="lp-graph-legend"><span><i/> Patient</span><span><i/> FHIR document</span><span><i/> Clinical resource</span></div><a className="lp-button" href="#preview">Explore the original records <ArrowUpRight size={18}/></a><span className="lp-dark-note">Two distinct patients. Their histories are never merged.</span></div><div className="lp-provenance-graph"><RepositoryStory reports={reports} graph/></div></section>

      <section className="lp-privacy" id="privacy"><div className="lp-privacy-heading"><ShieldCheck size={40} strokeWidth={1.4} /><h2>Built with care.<br />Clear about its limits.</h2></div><div className="lp-privacy-grid"><article><h3>Permission before access.</h3><p>Server-side checks protect the demonstration workflow. Revocation blocks subsequent retrieval; it cannot undo a previous download.</p></article><article><h3>Uncertainty stays visible.</h3><p>Missing records and contradictory statements remain explicit. A summary never claims to include a hospital that could not be reached.</p></article><article><h3>A prototype, honestly.</h3><p>Public repository samples, authenticated clinician access and demonstration report grants. Official FHIR validation and live hospital exchange remain pending.</p></article></div></section>

      <section className="lp-faq"><div><div className="lp-eyebrow">A FEW GOOD QUESTIONS</div><h2>Clarity starts<br />with honesty.</h2><span className="lp-handwritten">no fine-print surprises.</span></div><div>{faq.map((item) => <details key={item.q}><summary>{item.q}<Plus size={18} /></summary><p>{item.a}</p></details>)}</div></section>

      <section className="lp-final"><span className="lp-eyebrow">LESS FRAGMENTATION. MORE UNDERSTANDING.</span><h2>Let&apos;s connect<br />the whole story<span className="lp-final-star" aria-hidden="true">✳</span></h2><Link href="/workspace" className="lp-button lp-button-white">Open Zuma workspace <ArrowUpRight size={23} /></Link><p>Explore public sample records. Keep the doctor in control.</p><div className="lp-story-links"><a href="#preview">Patient & source</a><ArrowRight size={15}/><a href="#evidence">Clinical resources</a><ArrowRight size={15}/><Link href="/workspace">Doctor review</Link><a href="https://github.com/NHA-ABDM/ABDM-wrapper" target="_blank" rel="noreferrer">NHA source repository ↗</a></div></section>
    </main>
    <footer className="lp-footer"><Link href="/" className="lp-logo"><span className="lp-logo-mark"><Plus size={22} strokeWidth={3} /></span><span>Zuma</span></Link><p>Healthcare interoperability, with evidence.<br /><span>Repository sample prototype · PS-013 · Zuma</span></p><a href="#privacy">Privacy & prototype scope <ArrowUpRight size={15} /></a></footer>
  </div>;
}
