import Link from "next/link";
import { ArrowUpRight, FileText, ShieldCheck, Check } from "lucide-react";
import "./why-zuma.css";

const reasons = [
  { icon: FileText, title: "See the evidence behind the answer.", body: "A short brief helps you find the relevant details. Supporting passages and the original report remain available for inspection.", proof: "Explore the source records", href: "#evidence" },
  { icon: ShieldCheck, title: "Keep each patient’s boundaries intact.", body: "Clinician membership and report permission are checked on the server. The two sample patients stay separate, and an identity mismatch blocks retrieval.", proof: "Inspect the access checks", href: "https://github.com/ROHITHELAYARAJA/Zuma/blob/main/server/abdm.ts" },
  { icon: Check, title: "Keep the doctor in control.", body: "Review and edit the draft before approval. Export is a separate action. Missing dates and uncertain source terminology stay visible for review.", proof: "Try the review workflow", href: "/workspace" },
];

export default function WhyZuma() {
  return <section className="lp-why" id="why-zuma" aria-labelledby="why-zuma-heading">
    <div className="lp-why-heading"><div><span className="lp-eyebrow">WHY CHOOSE ZUMA?</span><h2 id="why-zuma-heading">Trust starts with<br/>something you can check.</h2></div><p>For doctors, a clearer path to the relevant evidence. For patients, visible access boundaries. For both, a record of what was reviewed.</p></div>
    <div className="lp-why-grid">{reasons.map(({ icon: Icon, title, body, proof, href }, i) => <article key={title}><div className="lp-why-icon"><Icon size={25}/><span>0{i+1}</span></div><h3>{title}</h3><p>{body}</p><a href={href} {...(href.startsWith("https:")?{target:"_blank",rel:"noreferrer"}:{})}>{proof}<ArrowUpRight size={15}/></a></article>)}</div>
    <div className="lp-proof-ledger"><div><span className="lp-eyebrow">EVIDENCE, NOT ENDORSEMENTS</span><h3>Check what this prototype is built on.</h3></div><ul>
      <li><strong>Published source material</strong><span>Two distinct sample FHIR documents from the NHA repository, with original source links.</span><a href="https://github.com/NHA-ABDM/ABDM-wrapper" target="_blank" rel="noreferrer">NHA sample repository ↗</a></li>
      <li><strong>Inspectable safeguards</strong><span>Focused tests cover permission denial, source-linked streaming, revocation, identity mismatch, provider access and missing-service failure.</span><a href="https://github.com/ROHITHELAYARAJA/Zuma/blob/main/tests/abdm-stream.test.ts" target="_blank" rel="noreferrer">Review the test cases ↗</a></li>
      <li><strong>A documented exchange standard</strong><span>Original FHIR content is preserved. Official ABDM profile validation remains a separate requirement.</span><a href="https://nrces.in/ndhm/fhir/r4/" target="_blank" rel="noreferrer">ABDM FHIR implementation guide ↗</a></li>
    </ul></div>
    <div className="lp-why-scope"><p><strong>What we can claim today:</strong> a working, source-linked sample-data prototype. Clinical accuracy, time savings and patient outcomes have not been established in clinical studies. Live hospital exchange and official validation remain pending. Using NHA sample material does not imply government endorsement.</p><Link href="/workspace">Explore Zuma yourself <ArrowUpRight size={17}/></Link></div>
  </section>;
}
