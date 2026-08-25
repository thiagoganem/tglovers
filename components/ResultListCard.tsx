"use client";

import { AlertIcon, CheckIcon, DownloadIcon, InfoIcon, TrashIcon } from "./icons";
import { downloadUrl, type ProcessResult } from "@/lib/api";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";

type ResultListCardProps = {
  results: ProcessResult[];
  onReset: () => void;
  onDiscardAll: () => void;
};

/**
 * O desfecho de um envio sem junção: um cartão por arquivo, cada um com o
 * próprio download. Sem prévia e sem editor — quem quiser refinar um documento
 * específico envia ele sozinho em seguida.
 */
export function ResultListCard({ results, onReset, onDiscardAll }: ResultListCardProps) {
  return (
    <section className="card">
      <div className="result__banner">
        <span className="result__badge">
          <CheckIcon size={19} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="result__headline">Documentos prontos</div>
          <div className="result__sub">
            {results.length} arquivos processados separadamente
          </div>
        </div>
      </div>

      <ul style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 20px" }}>
        {results.map((result) => {
          return (
            <li
              key={result.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="result__sub"
                  style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={result.filename}
                >
                  {result.filename}
                </div>
                <div className="result__sub">
                  {formatBytes(result.originalSize)} → {formatBytes(result.finalSize)}
                  {" · "}
                  {formatPercent(result.reductionPercent)}
                  {" · "}
                  {formatNumber(result.pages)} página{result.pages > 1 ? "s" : ""}
                  {result.ocrApplied
                    ? ` · OCR em ${result.ocrPages} página${result.ocrPages > 1 ? "s" : ""}`
                    : " · já continha texto"}
                </div>
                {result.warnings.length > 0 && (
                  <div className="alert alert--warning" style={{ marginTop: 6 }}>
                    <AlertIcon size={17} />
                    <span>{result.warnings[0].message}</span>
                  </div>
                )}
              </div>
              <a
                className="button button--brand"
                href={downloadUrl(result.id)}
                download={result.filename}
              >
                <DownloadIcon />
                Baixar
              </a>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <div className="alert alert--info" style={{ flex: 1, minWidth: 0 }}>
          <InfoIcon size={17} />
          <span>
            A edição de texto fica disponível apenas para um documento por vez —
            envie o arquivo sozinho para poder editá-lo.
          </span>
        </div>
        <span className="actions__spacer" />
        <button type="button" className="button button--outline" onClick={onReset}>
          Novo arquivo
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={onDiscardAll}
          title="Apagar do servidor agora"
        >
          <TrashIcon />
          Descartar todos
        </button>
      </div>
    </section>
  );
}
