/** Render verified answer text without interpreting HTML or changing clinical claims. */
export default function ClinicalAnswer({ text }: { text: string }) {
  return <div className="clinical-answer">{text.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const hasHeading = lines.length > 1 && lines[0].length <= 100 && !/[.!?\[\]]/.test(lines[0]);
    const claims = hasHeading ? lines.slice(1) : lines;
    return <section key={index}>
      {hasHeading && <h4>{lines[0]}</h4>}
      {claims.length > 1 ? <ul>{claims.map((claim, i) => <li key={i}>{claim.replace(/^[-•]\s*/, "")}</li>)}</ul> : <p>{claims[0]}</p>}
    </section>;
  })}</div>;
}
