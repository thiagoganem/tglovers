"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AlertIcon, CheckIcon, DownloadIcon, InfoIcon, TrashIcon } from "./icons";
import { downloadUrl, renameResult, type ProcessResult } from "@/lib/api";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";

/** Deixa o nome apto a virar arquivo: sem caminho, com o .pdf no fim. */
function limparNome(bruto: string): string {
  const limpo = bruto.replace(/[\\/]/g, " ").trim().slice(0, 120);
  if (!limpo) return "";
  return limpo.toLowerCase().endsWith(".pdf") ? limpo : `${limpo}.pdf`;
}

/** Um arquivo da lista: nome editável e o próprio download. */
function ItemResultado({ result }: { result: ProcessResult }) {
  const [nome, setNome] = useState(result.filename);
  const [edicao, setEdicao] = useState<string | null>(null);

  /** Fecha a edição e devolve o nome que ficou valendo. */
  const confirmarNome = useCallback(async (): Promise<string> => {
    if (edicao === null) return nome;
    const bruto = edicao;
    setEdicao(null);

    const novo = limparNome(bruto);
    if (!novo || novo === nome) return nome;
    try {
      // O servidor guarda o nome: é dele que vem o Content-Disposition do
      // download — atributo `download` de link não vale entre domínios.
      const retorno = await renameResult(result.id, novo);
      setNome(retorno.filename);
      return retorno.filename;
    } catch {
      /* Sem rede para renomear: fica o nome que já estava. */
      return nome;
    }
  }, [edicao, nome, result.id]);

  const baixar = useCallback(
    async (evento: React.MouseEvent<HTMLAnchorElement>) => {
      if (edicao === null) {
        toast.success(`Download iniciado: ${nome}`);
        return; // sem edição pela metade, o link segue normal
      }

      // Clicou em baixar com o nome aberto: o blur até dispara o rename, mas
      // o download sairia antes de o servidor conhecer o nome novo. Então o
      // clique espera — e segue para o mesmo destino depois da troca feita.
      const destino = evento.currentTarget.href;
      evento.preventDefault();
      const final = await confirmarNome();
      toast.success(`Download iniciado: ${final}`);
      window.location.assign(destino);
    },
    [confirmarNome, edicao, nome],
  );

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <input
          className="nome-editavel"
          style={{ fontWeight: 600 }}
          value={edicao !== null ? edicao : nome}
          title="Nome do PDF que será baixado — clique para alterar"
          aria-label={`Nome do arquivo ${result.id}`}
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
        download={nome}
        onClick={(evento) => void baixar(evento)}
      >
        <DownloadIcon />
        Baixar
      </a>
    </li>
  );
}

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
        {results.map((result) => (
          <ItemResultado key={result.id} result={result} />
        ))}
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
