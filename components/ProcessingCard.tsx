"use client";

import { CheckIcon, FileIcon } from "./icons";
import { formatBytes } from "@/lib/format";

/** Etapas exibidas na barra de progresso, na ordem em que acontecem. */
export const STAGES = [
  { id: "upload", label: "Upload" },
  { id: "analise", label: "Análise" },
  { id: "ocr", label: "OCR" },
  { id: "otimizacao", label: "Otimização" },
  { id: "finalizacao", label: "Finalização" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

type ProcessingCardProps = {
  filename: string;
  filesize: number;
  stage: StageId;
  percent: number;
  message: string;
  onCancel: () => void;
};

export function ProcessingCard({
  filename,
  filesize,
  stage,
  percent,
  message,
  onCancel,
}: ProcessingCardProps) {
  const currentIndex = STAGES.findIndex((item) => item.id === stage);

  return (
    <section className="card progress" aria-live="polite">
      <div className="progress__file">
        <span className="progress__avatar">
          <FileIcon size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="progress__filename" title={filename}>
            {filename}
          </div>
          <div className="result__sub">{formatBytes(filesize)}</div>
        </div>
      </div>

      <div>
        <div className="bar">
          <div className="bar__fill" style={{ width: `${Math.max(percent, 2)}%` }} />
        </div>
        <div className="progress__status">
          <span>{message}</span>
          <span className="progress__percent">{Math.round(percent)}%</span>
        </div>
      </div>

      <ol className="stages">
        {STAGES.map((item, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={item.id}
              className={`stage${done ? " stage--done" : ""}${active ? " stage--active" : ""}`}
            >
              <span className="stage__dot">
                {done ? <CheckIcon size={14} /> : index + 1}
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button type="button" className="button button--outline button--small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
