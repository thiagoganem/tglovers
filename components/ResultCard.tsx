"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertIcon, CheckIcon, CopyIcon, DownloadIcon, InfoIcon, TrashIcon } from "./icons";
import { TextEditor } from "./TextEditor";
import { useModoFoco } from "./Navigation";
import { downloadUrl, previewUrl, refineResult, renameResult, type ProcessResult } from "@/lib/api";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";

type ResultCardProps = {
  result: ProcessResult;
  targetBytes: number;
  onReset: () => void;
  onDiscard: () => void;
};

/** Deixa o nome apto a virar arquivo: sem caminho, com o .pdf no fim. */
function limparNome(bruto: string): string {
  const limpo = bruto.replace(/[\\/]/g, " ").trim().slice(0, 120);
  if (!limpo) return "";
  return limpo.toLowerCase().endsWith(".pdf") ? limpo : `${limpo}.pdf`;
}

export function ResultCard({ result, targetBytes, onReset, onDiscard }: ResultCardProps) {
  const [tab, setTab] = useState<"preview" | "editor">("preview");
  //: Sobe a cada correção aplicada. Entra na URL da prévia e do download para
  //: que o navegador busque o arquivo novo em vez de servir o que tem em cache.
  const [version, setVersion] = useState(result.version ?? 1);
  const [finalSize, setFinalSize] = useState(result.finalSize);
  //: O nome é o que o download leva — editável no próprio banner. `edicao`
  //: segura o texto enquanto o campo está aberto; vazio (null) é só exibição.
  const [nome, setNome] = useState(result.filename);
  const [edicao, setEdicao] = useState<string | null>(null);
  //: O rename em andamento, quando existe. O blur do campo dispara a troca
  //: antes do clique em Baixar chegar — quem baixa precisa esperar essa
  //: promessa, não começar outra nem sair antes dela.
  const renomeEmCurso = useRef<Promise<string> | null>(null);

  /** Fecha a edição e devolve o nome que ficou valendo (ou que ainda vai valer). */
  const confirmarNome = useCallback(async (): Promise<string> => {
    if (edicao === null) {
      return renomeEmCurso.current ? await renomeEmCurso.current : nome;
    }
    const bruto = edicao;
    setEdicao(null);

    const novo = limparNome(bruto);
    if (!novo || novo === nome) return nome;
    // O servidor guarda o nome: é dele que vem o Content-Disposition do
    // download — atributo `download` de link não vale entre domínios.
    const promessa = renameResult(result.id, novo)
      .then((retorno) => {
        setNome(retorno.filename);
        return retorno.filename;
      })
      .catch(() => nome); // sem rede: fica o nome que estava
    renomeEmCurso.current = promessa;
    try {
      return await promessa;
    } finally {
      renomeEmCurso.current = null;
    }
  }, [edicao, nome, result.id]);

  const baixar = useCallback(
    async (evento: React.MouseEvent<HTMLAnchorElement>) => {
      // Baixar sempre passa por aqui: com o campo ainda aberto, o blur do
      // clique dispara o rename um instante antes — e o download padrão
      // sairia com o nome de antes, vencendo a corrida. Segurar o clique e
      // esperar o nome definitivo no servidor é o único caminho sem corrida.
      const destino = evento.currentTarget.href;
      evento.preventDefault();
      const final = await confirmarNome();
      toast.success(`Download iniciado: ${final}`);
      window.location.assign(destino);
    },
    [confirmarNome],
  );

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
      toast.success("Texto copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o texto.");
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
            <div className="result__sub" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <input
                className="nome-editavel"
                value={edicao !== null ? edicao : nome}
                title="Nome do PDF que será baixado — clique para alterar"
                aria-label="Nome do arquivo"
                spellCheck={false}
                onFocus={() => setEdicao(nome)}
                onChange={(evento) => setEdicao(evento.target.value)}
                onBlur={() => void confirmarNome()}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") evento.currentTarget.blur();
                  if (evento.key === "Escape") {
                    setEdicao(null);
                    evento.currentTarget.blur();
                  }
                }}
              />
              <span style={{ flex: "none" }}>
                {result.ocrApplied
                  ? `· OCR aplicado em ${result.ocrPages} página${result.ocrPages > 1 ? "s" : ""}`
                  : "· o documento já continha texto"}
              </span>
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
            download={nome}
            onClick={(evento) => void baixar(evento)}
          >
            <DownloadIcon />
            Baixar PDF
          </a>
          <button type="button" className="button button--outline" onClick={copyText}>
            <CopyIcon />
            Copiar texto
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
            title={`Pré-visualização de ${nome}`}
          />
        ) : result.text ? (
          <TextEditor
            initialText={result.text}
            filename={nome}
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
