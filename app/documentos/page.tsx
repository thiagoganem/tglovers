"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dropzone, type Escolhido } from "@/components/Dropzone";
import { ProcessingCard, type StageId } from "@/components/ProcessingCard";
import { ResultCard } from "@/components/ResultCard";
import { ResultListCard } from "@/components/ResultListCard";
import { AlertIcon } from "@/components/icons";
import {
  ApiError,
  discardResult,
  fetchConfig,
  processFiles,
  type ProcessResult,
  type ServerConfig,
} from "@/lib/api";
import { SITE } from "@/lib/site";

/** Configuração usada até o servidor responder (evita tela vazia no primeiro paint). */
const FALLBACK_CONFIG: ServerConfig = {
  maxUploadBytes: 100 * 1024 * 1024,
  targetBytes: 10 * 1024 * 1024,
  maxPages: 300,
  acceptedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff"],
  acceptedLabels: ["PDF", "JPG", "PNG", "TIFF"],
  languages: [],
  lowConfidenceThreshold: 75,
  maxFiles: 20,
};

/** Fração da barra reservada para o upload; o resto vem do servidor. */
const UPLOAD_SHARE = 18;

type Phase = "idle" | "processing" | "done";

export default function Documentos() {
  const [config, setConfig] = useState<ServerConfig>(FALLBACK_CONFIG);
  //: `null` enquanto a configuração não chegou. Distingue "servidor
  //: inalcançável" de "servidor respondeu e não tem OCR" — que exigem
  //: mensagens completamente diferentes.
  const [configLoaded, setConfigLoaded] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [itens, setItens] = useState<Escolhido[]>([]);
  //: Junção marcada = comportamento de sempre (tudo vira um PDF só). A opção
  //: só aparece com mais de um arquivo — e vem desmarcada: com vários, o que
  //: se espera é cada arquivo com o seu próprio PDF.
  const [juntar, setJuntar] = useState(true);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<StageId>("upload");
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("Enviando arquivo");

  const abortRef = useRef<AbortController | null>(null);
  const peakRef = useRef(0);

  // A barra nunca anda para trás: upload e servidor reportam em escalas distintas.
  const advance = useCallback((next: number) => {
    peakRef.current = Math.max(peakRef.current, next);
    setPercent(peakRef.current);
  }, []);

  // Sair da página cancela o acompanhamento: sem isto, a sondagem seguiria
  // rodando contra um componente que não existe mais.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    fetchConfig()
      .then((loaded) => {
        setConfig(loaded);
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(false));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    peakRef.current = 0;
    setPhase("idle");
    setItens([]);
    setResults([]);
    setError(null);
    setPercent(0);
    setStage("upload");
  }, []);

  const start = useCallback(async () => {
    if (itens.length === 0) return;

    const jobId =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const controller = new AbortController();

    abortRef.current = controller;
    peakRef.current = 0;
    setResults([]);
    setError(null);
    setPhase("processing");
    setStage("upload");
    setPercent(0);
    setMessage("Enviando arquivos");

    try {
      const processed = await processFiles(
        itens.map((item) => item.file),
        {
          // Os antigos controles saíram da tela: o padrão serve para todo mundo
          // e a decisão é do servidor (idioma detectado, OCR só onde falta
          // texto, compressão só quando o arquivo passa da meta). A junção é a
          // única exceção — ficou como opção, escolhida antes de processar.
          language: "auto",
          forceOcr: false,
          alwaysCompress: false,
          mergeFiles: juntar,
          jobId,
          signal: controller.signal,
          onUploadProgress: (fraction) => {
            advance(fraction * UPLOAD_SHARE);
            if (fraction >= 1) setMessage("Arquivos recebidos, iniciando análise");
          },
          // O acompanhamento agora mora no cliente da API, junto com a espera
          // pelo resultado — uma sondagem só, em vez de duas contra o mesmo
          // endereço.
          onStage: (progress) => {
            if (progress.stage && progress.stage !== "upload") {
              setStage(progress.stage as StageId);
              setMessage(progress.message);
              advance(progress.percent);
            }
          },
        },
      );
      advance(100);
      setResults(processed);
      setPhase("done");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "aborted") {
        setPhase("idle");
        setPercent(0);
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : "Erro inesperado ao processar o documento.",
      );
      setPhase("idle");
    } finally {
      abortRef.current = null;
    }
  }, [advance, itens, juntar]);

  const discard = useCallback(() => {
    for (const item of results) discardResult(item.id);
    reset();
  }, [reset, results]);

  // Só faz sentido falar de OCR indisponível depois que o servidor respondeu.
  const ocrUnavailable = configLoaded === true && config.languages.length === 0;
  const serverUnreachable = configLoaded === false;

  return (
    <div className={`stack${phase === "done" ? " stack--wide" : ""}`}>
      {phase === "idle" && (
        <>
          <div className="hero">
            <h1>{SITE.headline}</h1>
            <p>{SITE.tagline}</p>
          </div>

          {serverUnreachable && (
            <div className="alert alert--danger" style={{ marginBottom: 18 }}>
              <AlertIcon size={17} />
              <span>
                O servidor de processamento não respondeu. Se o problema persistir,
                verifique se o backend está no ar e acessível pelo endereço configurado.
              </span>
            </div>
          )}

          {error && (
            <div className="alert alert--danger" style={{ marginBottom: 18 }}>
              <AlertIcon size={17} />
              <span>{error}</span>
            </div>
          )}

          {ocrUnavailable && (
            <div className="alert alert--warning" style={{ marginBottom: 18 }}>
              <AlertIcon size={17} />
              <span>
                Nenhum idioma de OCR está instalado no servidor. O documento ainda será
                otimizado, mas não haverá reconhecimento de texto.
              </span>
            </div>
          )}

          <Dropzone
            accept={config.acceptedExtensions}
            labels={config.acceptedLabels}
            maxBytes={config.maxUploadBytes}
            maxFiles={config.maxFiles}
            targetBytes={config.targetBytes}
            itens={itens}
            juntar={juntar}
            onItens={(proximos) => {
              setItens(proximos);
              setError(null);
              // A lista mudou de mão: a decisão de juntar volta ao que se
              // espera para o novo conjunto — separado, quando há de quê.
              setJuntar(proximos.length <= 1);
            }}
            onReject={setError}
          />

          {itens.length > 1 && (
            <label
              // A escolha precisa ser consciente e antes do processamento:
              // decidir depois de subir os bytes seria recomeçar tudo.
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={juntar}
                onChange={(event) => setJuntar(event.target.checked)}
              />
              <span>Juntar os arquivos em um único PDF</span>
            </label>
          )}

          <button
            type="button"
            className="button button--brand button--cta"
            disabled={itens.length === 0}
            onClick={start}
          >
            {itens.length > 1 ? `Processar ${itens.length} arquivos` : "Processar documento"}
          </button>

        </>
      )}

      {phase === "processing" && itens.length > 0 && (
        <ProcessingCard
          filename={
            itens.length > 1
              ? `${itens.length} arquivos · ${itens[0].file.name}`
              : itens[0].file.name
          }
          filesize={itens.reduce((soma, item) => soma + item.file.size, 0)}
          stage={stage}
          percent={percent}
          message={message}
          onCancel={() => abortRef.current?.abort()}
        />
      )}

      {phase === "done" && results.length === 1 && (
        <ResultCard
          result={results[0]}
          targetBytes={config.targetBytes}
          onReset={reset}
          onDiscard={discard}
        />
      )}

      {phase === "done" && results.length > 1 && (
        <ResultListCard results={results} onReset={reset} onDiscardAll={discard} />
      )}
    </div>
  );
}
