import { useMemo, useState } from "react";
import {
  FileText,
  Sparkles,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  Clock3,
  ShieldCheck,
  GitCompareArrows,
} from "lucide-react";
import type { ClinicalRecord, Workspace } from "../shared/types";
import { Badge, CitationButtons, Empty } from "./components";
import { date, time } from "./lib/api";

type Props = {
  workspace: Workspace;
  openRecord: (id: string) => void;
  busy: boolean;
};
export function SummaryPanel({
  workspace: w,
  openRecord,
  onGenerate,
  busy,
}: Props & { onGenerate: () => void }) {
  return (
    <section className="panel summary-panel">
      <div className="panel-heading">
        <h2>
          <FileText size={20} />
          Clinical summary
        </h2>
        <button
          className="icon-button summary-generate"
          onClick={onGenerate}
          disabled={busy || !w.records.length}
          aria-label={
            busy
              ? "Preparing summary"
              : w.summary
                ? "Regenerate summary"
                : "Generate summary"
          }
          title={
            busy
              ? "Preparing summary"
              : w.summary
                ? "Regenerate summary"
                : "Generate summary"
          }
        >
          <Sparkles size={17} />
        </button>
      </div>
      <p className="summary-drafted">
        {w.summary
          ? `Drafted on ${date(w.summary.generatedAt)}, ${time(w.summary.generatedAt)}`
          : "Awaiting an evidence-backed draft"}
      </p>
      <div className="key-information">
        <h3>Source coverage</h3>
        <div className="source-coverage-list">
          {w.hospitals.map((h) => {
            const records = w.records
              .filter((r) => r.hospitalId === h.id)
              .sort((a, b) => b.clinicalDate.localeCompare(a.clinicalDate));
            const latestSource = records[0];
            return (
              <button
                className="source-coverage-row"
                key={h.id}
                disabled={!latestSource}
                onClick={() => latestSource && openRecord(latestSource.id)}
              >
                <span className={`hospital-dot hospital-${h.id}`}>{h.id}</span>
                <span>
                  <strong>{h.name}</strong>
                  <small>
                    {latestSource
                      ? `Records to ${date(latestSource.clinicalDate)}`
                      : h.status === "unavailable"
                        ? "Source connection unavailable"
                        : "No permitted records"}
                  </small>
                </span>
                <Badge tone={latestSource ? "mint" : "muted"}>
                  {latestSource ? "Available" : "Unavailable"}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
      {w.summary ? (
        <>
          <div className="summary-meta">
            <Badge tone={w.summary.status === "approved" ? "mint" : "blue"}>
              {w.summary.status === "approved" ? (
                <ShieldCheck size={12} />
              ) : (
                <Sparkles size={12} />
              )}{" "}
              {w.summary.status === "approved"
                ? "Clinician approved"
                : "Evidence draft"}
            </Badge>
            <span>Updated {time(w.summary.generatedAt)}</span>
          </div>
          {w.summary.status === "approved" && (
            <div className="approved-summary">
              <h3>Approved report</h3>
              <p>{w.summary.text}</p>
            </div>
          )}
          {w.summary.sections.map((section, i) => (
            <div className="summary-section" key={`${section.title}-${i}`}>
              <h3>{section.title}</h3>
              {section.items.length ? (
                section.items.map((item, j) => (
                  <div className="summary-item" key={j}>
                    <span className="mint-dot" />
                    <div>
                      <p>{item.text}</p>
                      <CitationButtons
                        ids={item.citationIds}
                        citations={w.citations}
                        onOpen={openRecord}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No information in the available records.
                </p>
              )}
            </div>
          ))}
          <div className="coverage-note">
            <Clock3 size={15} />
            <p>{w.summary.coverage}</p>
          </div>
        </>
      ) : (
        <Empty title="Ready when you are">
          Generate a draft from the {w.records.length} permitted records. Every
          finding stays connected to its source.
        </Empty>
      )}
      <p className="panel-footnote">
        Synthetic evidence. Review source records before clinical use.
      </p>
    </section>
  );
}

export function TimelinePanel({ workspace: w, openRecord }: Props) {
  const [filter, setFilter] = useState("all");
  const timeline = w.timeline
    .filter((r) => filter === "all" || r.kind === filter)
    .sort((a, b) => b.clinicalDate.localeCompare(a.clinicalDate));
  const labGroups = useMemo(() => {
    const groups = new Map<string, ClinicalRecord[]>();
    w.records
      .filter((r) => r.kind === "lab" && typeof r.value === "number")
      .forEach((r) => {
        const key = `${r.code || r.title}|${r.unit}`;
        groups.set(key, [...(groups.get(key) || []), r]);
      });
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [w.records]);
  const [labIndex, setLabIndex] = useState(0);
  const labs = (labGroups[labIndex]?.[1] || labGroups[0]?.[1] || [])
    .slice()
    .sort((a, b) => a.clinicalDate.localeCompare(b.clinicalDate));
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <h2>
          <FileText size={20} />
          Evidence timeline
        </h2>
        <label className="sr-only" htmlFor="report-filter">
          Filter reports
        </label>
        <select
          id="report-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All reports</option>
          <option value="lab">Lab results</option>
          <option value="allergy">Allergies</option>
          <option value="medication">Medicines</option>
          <option value="note">Clinical notes</option>
        </select>
      </div>
      <div className="timeline-list">
        {timeline.length ? (
          timeline.map((r) => (
            <button
              className="timeline-item"
              key={r.id}
              onClick={() => openRecord(r.id)}
            >
              <span className={`timeline-node hospital-${r.hospitalId}`} />
              <div className="timeline-date">
                <strong>{date(r.clinicalDate)}</strong>
                <small>{r.hospital}</small>
              </div>
              <div className="timeline-detail">
                <span>{r.title}</span>
                <small>
                  {r.kind === "lab"
                    ? `${r.value ?? "—"} ${r.unit || ""}`
                    : r.kind === "allergy"
                      ? "Allergy record"
                      : r.kind === "medication"
                        ? "Medication record"
                        : "Clinical note"}
                </small>
              </div>
              <ChevronRight size={14} />
            </button>
          ))
        ) : (
          <Empty title="No reports in this view">
            Change the filter or check source access.
          </Empty>
        )}
      </div>
      <div className="chart-section">
        <div className="chart-heading">
          <h2>
            <ChartNoAxesCombined size={20} />
            Result history
          </h2>
          {labGroups.length > 0 && (
            <select
              aria-label="Result to plot"
              value={Math.min(labIndex, labGroups.length - 1)}
              onChange={(e) => setLabIndex(Number(e.target.value))}
            >
              {labGroups.map(([key, items], i) => (
                <option value={i} key={key}>
                  {items[0]?.title} ({items[0]?.unit})
                </option>
              ))}
            </select>
          )}
        </div>
        {labs.length > 0 ? (
          <LabChart records={labs} onOpen={openRecord} />
        ) : (
          <Empty title="No comparable results">
            Numeric results with matching codes and units appear here.
          </Empty>
        )}
        <p className="panel-footnote">
          Same test code and unit only. Open each result for context.
        </p>
      </div>
      <div className="source-freshness">
        <Clock3 size={15} />
        <span>
          Retrieved {w.records[0] ? date(w.records[0].retrievedAt) : "—"}.
          Clinical dates shown above.
        </span>
      </div>
    </section>
  );
}

function LabChart({
  records,
  onOpen,
}: {
  records: ClinicalRecord[];
  onOpen: (id: string) => void;
}) {
  const values = records.map((r) => r.value!);
  const min = Math.max(0, Math.min(...values) * 0.7);
  const max = Math.max(...values) * 1.2 || 1;
  const height = 140;
  const width = 320;
  const points = records.map((r, i) => ({
    x:
      records.length === 1
        ? width / 2
        : 20 + (i * (width - 40)) / (records.length - 1),
    y: height - 20 - ((r.value! - min) / (max - min)) * (height - 40),
    r,
  }));
  return (
    <div className="lab-chart">
      <svg
        viewBox={`0 0 ${width} ${height + 30}`}
        role="img"
        aria-label={`Result history: ${records.map((r) => `${date(r.clinicalDate)} ${r.value} ${r.unit}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111111" stopOpacity=".3" />
            <stop offset="100%" stopColor="#111111" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 55, 90, 125].map((y) => (
          <line
            key={y}
            x1="10"
            y1={y}
            x2="310"
            y2={y}
            stroke="#DEDEDE"
            strokeWidth=".6"
          />
        ))}
        <path
          d={`M ${points.map((p) => `${p.x},${p.y}`).join(" L ")} L ${points.at(-1)!.x},${height - 15} L ${points[0].x},${height - 15} Z`}
          fill="url(#chart-fill)"
        />
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#111111"
          strokeWidth="3"
        />
        {points.map(({ x, y, r }, i) => (
          <g
            key={r.id}
            onClick={() => onOpen(r.id)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={x}
              cy={y}
              r="4.5"
              fill="#FF5B3E"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x={x}
              y={y - 12}
              fill="#111111"
              fontSize="11"
              textAnchor="middle"
            >
              {r.value}
            </text>
            <text
              x={x}
              y={height + 9}
              fill="#666666"
              fontSize="9"
              textAnchor={
                i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
              }
            >
              {date(r.clinicalDate, { year: undefined })}
            </text>
          </g>
        ))}
      </svg>
      <div className="chart-links">
        {records.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className="subtle-link"
          >
            {r.hospitalId}: {r.value} {r.unit}
            <ArrowUpRight size={11} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConflictBanner({
  workspace: w,
  onReview,
}: {
  workspace: Workspace;
  onReview: () => void;
}) {
  const conflicts = w.findings.filter((f) => f.category === "conflict");
  const missing = w.findings.filter((f) => f.category === "missing");
  if (!conflicts.length && !missing.length)
    return (
      <div className="info-banner">
        <ShieldCheck size={18} />
        <strong>
          {w.records.length
            ? "Available evidence checked"
            : "No evidence available"}
        </strong>
        <span>
          {w.records.length
            ? "No contradictions detected by the supported demo checks."
            : "Confirm patient links and access permissions to retrieve reports."}
        </span>
      </div>
    );
  return (
    <div className="conflict-banner">
      <GitCompareArrows size={23} />
      <strong>{conflicts[0]?.title || missing[0]?.title}</strong>
      <span>
        {conflicts.length} conflicting{" "}
        {conflicts.length === 1 ? "finding" : "findings"} · {missing.length}{" "}
        missing evidence {missing.length === 1 ? "item" : "items"}
      </span>
      <button onClick={onReview}>
        Review evidence
        <ArrowUpRight size={15} />
      </button>
    </div>
  );
}
