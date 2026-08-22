"use client";

import { useCallback, useState } from "react";
import { AlertIcon, CheckIcon, CopyIcon, DownloadIcon, InfoIcon, TrashIcon } from "./icons";
import { TextEditor } from "./TextEditor";
import { useModoFoco } from "./Navigation";
import { downloadUrl, previewUrl, refineResult, type ProcessResult } from "@/lib/api";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";

type ResultCardProps = {
  result: ProcessResult;
  targetBytes: number;
  onReset: () => void;
  onDiscard: () => void;
};

export function ResultCard({ result, targetBytes, onReset, onDiscard }: ResultCardProps) {
  const [tab, setTab] = useState<"preview" | "editor">("preview");
  const [copied, setCopied] = useState(false);
  //: Sobe a cada correção aplicada. Entra na URL da prévia e do download para
  //: que o navegador busque o arquivo novo em vez de servir o que tem em cache.
  const [version, setVersion] = useState(result.version ?? 1);
  const [finalSize, setFinalSize] = useState(result.finalSize);

  // No editor a barra lateral sai de cena: ali o que falta é largura.
  useModoFoco(tab === "editor");

  const aplicarNoPdf = useCallback(
    async (texto: string) => {
      const retorno = await refineResult(result.id, texto);
      if (retorno.applied > 0) {
        setVersion(retorno.version);
        setFinalSize(retorno.finalSize);
      }
      return retorno;
    },
    [result.id],
  );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const grew = result.reductionPercent <= 0;
  const targetMb = Math.round(targetBytes / (1024 * 1024));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section className="card">
        <div className="result__banner">
          <span className="result__badge">
            <CheckIcon size={19} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="result__headline">Documento pronto</div>
            <div className="result__sub" title={result.filename}>
              {result.filename}
              {result.ocrApplied
                ? ` · OCR aplicado em ${result.ocrPages} página${result.ocrPages > 1 ? "s" : ""}`
                : " · o documento já continha texto"}
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat__label">Original</div>
            <div className="stat__value">{formatBytes(result.originalSize)}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Final</div>
            <div className={`stat__value ${result.withinTarget ? "stat__value--good" : "stat__value--warn"}`}>
              {formatBytes(finalSize)}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Redução</div>
            <div className={`stat__value ${grew ? "" : "stat__value--good"}`}>
              {formatPercent(result.reductionPercent)}
            </div>
          </div>
          <div className="stat">
            <div className="stat__label">Páginas</div>
            <div className="stat__value">{formatNumber(result.pages)}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Texto</div>
            <div className="stat__value">{formatNumber(result.characters)}</div>
          </div>
          {result.confidence !== null && (
            <div className="stat">
              <div className="stat__label">Confiança</div>
              <div
                className={`stat__value ${result.confidence >= 75 ? "stat__value--good" : "stat__value--warn"}`}
              >
                {result.confidence.toString().replace(".", ",")}%
              </div>
            </div>
          )}
        </div>

        {(result.warnings.length > 0 || grew) && (
          <div style={{ padding: "16px 20px 0" }}>
            {result.warnings.map((warning) => (
              <div key={warning.code} className="alert alert--warning">
                <AlertIcon size={17} />
                <span>{warning.message}</span>
              </div>
            ))}
            {grew && result.withinTarget && (
              <div className="alert alert--info">
                <InfoIcon size={17} />
                <span>
                  O arquivo já estava abaixo de {targetMb} MB, então a qualidade foi
                  preservada por inteiro — a camada de texto do OCR acrescentou alguns KB.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <a
            className="button button--brand"
            href={downloadUrl(result.id, version)}
            download={result.filename}
          >
            <DownloadIcon />
            Baixar PDF
          </a>
          <button type="button" className="button button--outline" onClick={copyText}>
            <CopyIcon />
            {copied ? "Copiado!" : "Copiar texto"}
          </button>
          <span className="actions__spacer" />
          <button type="button" className="button button--outline" onClick={onReset}>
            Novo arquivo
          </button>
          <button type="button" className="button button--danger" onClick={onDiscard} title="Apagar do servidor agora">
            <TrashIcon />
            Descartar
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              className={`tab${tab === "preview" ? " tab--active" : ""}`}
              onClick={() => setTab("preview")}
            >
              Visualizar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "editor"}
              className={`tab${tab === "editor" ? " tab--active" : ""}`}
              onClick={() => setTab("editor")}
            >
              Editar texto
            </button>
          </div>
          <span className="result__sub">
            {tab === "preview"
              ? "O texto do OCR está embutido: dá para selecionar e buscar no PDF"
              : "Edite à vontade e aplique — as correções entram no próprio PDF"}
          </span>
        </div>

        {tab === "preview" ? (
          <iframe
            // A chave inclui a versão: um `src` novo não basta para alguns
            // visualizadores de PDF recarregarem, mas remontar o iframe basta.
            key={version}
            className="viewer"
            src={previewUrl(result.id, version)}
            title={`Pré-visualização de ${result.filename}`}
          />
        ) : result.text ? (
          <TextEditor
            initialText={result.text}
            filename={result.filename}
            onAplicarNoPdf={aplicarNoPdf}
          />
        ) : (
          <div className="card__body">
            <div className="alert alert--warning">
              <AlertIcon size={17} />
              <span>
                Nenhum texto foi reconhecido neste documento, então não há o que editar.
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
