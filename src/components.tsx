import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  LoaderCircle,
  ArrowUpRight,
  FileText,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { Citation, ClinicalRecord } from "../shared/types";
import { date } from "./lib/api";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <header className="modal-header">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "mint" | "coral" | "blue" | "muted" | "amber";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Busy({ label = "Loading records…" }: { label?: string }) {
  return (
    <div className="busy" role="status">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={25} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function CitationButtons({
  ids,
  citations,
  onOpen,
}: {
  ids: string[];
  citations: Citation[];
  onOpen: (id: string) => void;
}) {
  return (
    <span className="citation-list">
      {ids.map((id) => {
        const cite = citations.find((c) => c.id === id);
        return cite ? (
          <button
            key={id}
            className="source-tag"
            title={`${cite.hospital} · ${cite.title}`}
            onClick={() => onOpen(cite.recordId)}
          >
            {cite.hospital.includes("Aster")
              ? "A"
              : cite.hospital.includes("Meridian")
                ? "B"
                : "Source"}
            <ArrowUpRight size={10} />
          </button>
        ) : null;
      })}
    </span>
  );
}
export function RecordButton({
  record,
  onOpen,
}: {
  record: ClinicalRecord;
  onOpen: (id: string) => void;
}) {
  return (
    <button className="record-link" onClick={() => onOpen(record.id)}>
      <span className={`hospital-dot hospital-${record.hospitalId}`}>
        {record.hospitalId}
      </span>
      <span>
        <strong>{record.title}</strong>
        <small>
          {record.hospital} · {date(record.clinicalDate)}
        </small>
      </span>
      <ArrowUpRight size={16} />
    </button>
  );
}
export function StatusIcon({ passed }: { passed: boolean }) {
  return passed ? (
    <Check size={16} className="mint-text" />
  ) : (
    <AlertTriangle size={16} className="coral-text" />
  );
}
