"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageDrop } from "@/components/sticker/ImageDrop";
import { PositionPicker } from "@/components/sticker/PositionPicker";
import { DestinationPicker } from "@/components/sticker/DestinationPicker";
import { WhatsAppStatus } from "@/components/sticker/WhatsAppStatus";
import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  ScissorsIcon,
  SendIcon,
  SparkIcon,
} from "@/components/icons";
import {
  criarComIa,
  descartarImagem,
  enviarFigurinha,
  enviarImagem,
  fetchEstado,
  gerarFigurinha,
  gerarPrevia,
  StickerError,
  sugerirLegendas,
  type Ajuste,
  type Conversa,
  type EstadoServico,
  type Montagem,
} from "@/lib/sticker";

type Imagem = { id: string; largura: number; altura: number; origem: "arquivo" | "ia" };
type Ocupado = null | "previa" | "recorte" | "envio" | "ia";

const LIMITE_PADRAO = { maxCaracteres: 180, maxImagemBytes: 12 * 1024 * 1024 };

/** Guarda um object URL e libera o anterior — sem vazar memória entre prévias. */
function useBlobUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const atual = useRef<string | null>(null);

  const trocar = useCallback((blob: Blob | null) => {
    if (atual.current) URL.revokeObjectURL(atual.current);
    const novo = blob ? URL.createObjectURL(blob) : null;
    atual.current = novo;
    setUrl(novo);
    return novo;
  }, []);

  useEffect(
    () => () => {
      if (atual.current) URL.revokeObjectURL(atual.current);
    },
    [],
  );

  return [url, trocar] as const;
}

export default function Figurinhas() {
  const [estado, setEstado] = useState<EstadoServico | null>(null);
  const [servicoFora, setServicoFora] = useState(false);
  const [conexaoAberta, setConexaoAberta] = useState(false);

  const [imagem, setImagem] = useState<Imagem | null>(null);
  const [legenda, setLegenda] = useState("");
  const [posicao, setPosicao] = useState("faixa-baixo");
  const [ajuste, setAjuste] = useState<Ajuste>("ajustar");
  const [destino, setDestino] = useState<Conversa | null>(null);

  const [previaUrl, trocarPrevia] = useBlobUrl();
  const [thumbUrl, trocarThumb] = useBlobUrl();
  const [figurinhaUrl, trocarFigurinha] = useBlobUrl();
  const [figurinhaKb, setFigurinhaKb] = useState(0);

  const [ocupado, setOcupado] = useState<Ocupado>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [promptIa, setPromptIa] = useState("");

  const abortPrevia = useRef<AbortController | null>(null);

  const limites = estado?.limites ?? LIMITE_PADRAO;
  const posicoes = useMemo(() => estado?.posicoes ?? [], [estado]);

  const montagem: Montagem | null = useMemo(
    () => (imagem ? { id: imagem.id, legenda, posicao, ajuste } : null),
    [ajuste, imagem, legenda, posicao],
  );

  /* ---------------------------------------------------------------- *
   * Estado do serviço
   * ---------------------------------------------------------------- */
  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      try {
        const novo = await fetchEstado();
        if (!vivo) return;
        setEstado(novo);
        setServicoFora(false);
      } catch {
        if (vivo) setServicoFora(true);
      }
    };
    buscar();
    const timer = setInterval(buscar, 5000);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Prévia — mudou a montagem, o recorte anterior deixa de valer
   * ---------------------------------------------------------------- */
  const invalidarRecorte = useCallback(() => {
    trocarFigurinha(null);
    setFigurinhaKb(0);
  }, [trocarFigurinha]);

  const chaveMontagem = montagem
    ? `${montagem.id}|${montagem.legenda}|${montagem.posicao}|${montagem.ajuste}`
    : "";

  useEffect(() => {
    if (!montagem) {
      trocarPrevia(null);
      return undefined;
    }

    abortPrevia.current?.abort();
    const controller = new AbortController();
    abortPrevia.current = controller;

    setOcupado("previa");
    const timer = setTimeout(async () => {
      try {
        const blob = await gerarPrevia(montagem, 512, controller.signal);
        if (!controller.signal.aborted) trocarPrevia(blob);
      } catch (err) {
        if (!controller.signal.aborted) {
          setErro(err instanceof StickerError ? err.message : "não consegui gerar a prévia");
        }
      } finally {
        if (!controller.signal.aborted) setOcupado(null);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveMontagem]);

  /* ---------------------------------------------------------------- *
   * Imagem
   * ---------------------------------------------------------------- */
  const aplicarImagem = useCallback(
    async (nova: Imagem) => {
      setImagem((anterior) => {
        // A imagem trocada não serve mais: some do disco do serviço.
        if (anterior && anterior.id !== nova.id) descartarImagem(anterior.id);
        return nova;
      });
      setErro(null);
      setSugestoes([]);
      invalidarRecorte();

      try {
        const blob = await gerarPrevia(
          { id: nova.id, legenda: "", posicao: "faixa-baixo", ajuste: "ajustar" },
          128,
        );
        trocarThumb(blob);
      } catch {
        trocarThumb(null);
      }
    },
    [invalidarRecorte, trocarThumb],
  );

  const subir = useCallback(
    async (arquivo: File) => {
      setOcupado("previa");
      try {
        const enviada = await enviarImagem(arquivo);
        await aplicarImagem({ ...enviada, origem: "arquivo" });
      } catch (err) {
        setErro(err instanceof StickerError ? err.message : "não consegui ler essa imagem");
      } finally {
        setOcupado(null);
      }
    },
    [aplicarImagem],
  );

  /* ---------------------------------------------------------------- *
   * Recortar e enviar
   * ---------------------------------------------------------------- */
  const recortar = useCallback(async () => {
    if (!montagem) return;
    setOcupado("recorte");
    setErro(null);
    try {
      const blob = await gerarFigurinha(montagem);
      trocarFigurinha(blob);
      setFigurinhaKb(Math.round(blob.size / 1024));
      setSucesso("Figurinha pronta. Escolha o destino e envie.");
    } catch (err) {
      setErro(err instanceof StickerError ? err.message : "não consegui gerar a figurinha");
    } finally {
      setOcupado(null);
    }
  }, [montagem, trocarFigurinha]);

  const enviar = useCallback(async () => {
    if (!montagem || !destino) return;
    setOcupado("envio");
    setErro(null);
    try {
      const resposta = await enviarFigurinha(montagem, destino.id);
      setSucesso(`Enviada para ${resposta.destino.nome} (${resposta.kb}KB).`);
    } catch (err) {
      setErro(err instanceof StickerError ? err.message : "não consegui enviar");
    } finally {
      setOcupado(null);
    }
  }, [destino, montagem]);

  /* ---------------------------------------------------------------- *
   * IA
   * ---------------------------------------------------------------- */
  const pedirSugestoes = useCallback(async () => {
    if (!imagem) return;
    setOcupado("ia");
    setErro(null);
    try {
      setSugestoes(await sugerirLegendas(imagem.id));
    } catch (err) {
      setErro(err instanceof StickerError ? err.message : "a IA não respondeu");
    } finally {
      setOcupado(null);
    }
  }, [imagem]);

  const criarImagem = useCallback(async () => {
    if (promptIa.trim().length < 3) return;
    setOcupado("ia");
    setErro(null);
    try {
      const criada = await criarComIa(promptIa.trim());
      await aplicarImagem({ ...criada, origem: "ia" });
      setPromptIa("");
      setSucesso("Imagem criada pela IA.");
    } catch (err) {
      setErro(err instanceof StickerError ? err.message : "a IA não conseguiu criar a imagem");
    } finally {
      setOcupado(null);
    }
  }, [aplicarImagem, promptIa]);

  // Sucesso é passageiro; erro fica na tela até ser resolvido.
  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(null), 6000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const conectado = !!estado?.wa.conectado;
  const usados = [...legenda].length;
  const podeRecortar = !!imagem && ocupado !== "recorte";
  const podeEnviar = !!figurinhaUrl && !!destino && conectado && ocupado !== "envio";

  return (
    <div className="stack stack--wide">
      <div className="modhead">
        <div>
          <h1>Figurinhas</h1>
          <p>Imagem em figurinha 512×512 e envio direto no WhatsApp.</p>
        </div>
        <WhatsAppStatus
          wa={servicoFora ? null : (estado?.wa ?? null)}
          aberto={conexaoAberta}
          onAbrir={() => setConexaoAberta(true)}
          onFechar={() => setConexaoAberta(false)}
        />
      </div>

      {servicoFora && (
        <div className="alert alert--danger" style={{ marginBottom: 18 }}>
          <AlertIcon size={17} />
          <span>
            O serviço de figurinhas não respondeu. Suba-o com <code>npm start</code> na pasta{" "}
            <code>sticker/</code> — ele escuta na porta 8100.
          </span>
        </div>
      )}

      {erro && (
        <div className="alert alert--danger" style={{ marginBottom: 18 }}>
          <AlertIcon size={17} />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="alert alert--success" style={{ marginBottom: 18 }}>
          <CheckIcon size={17} />
          <span>{sucesso}</span>
        </div>
      )}

      <div className="workbench">
        {/* ---------------------------- controles ---------------------------- */}
        <div className="workbench__controls">
          <section className="card">
            <div className="card__header">
              <strong className="step">
                <span className="step__num">1</span> Imagem
              </strong>
            </div>
            <div className="card__body">
              <ImageDrop
                thumb={thumbUrl}
                dimensoes={imagem ? { largura: imagem.largura, altura: imagem.altura } : null}
                origem={imagem?.origem ?? "arquivo"}
                maxBytes={limites.maxImagemBytes}
                disabled={servicoFora}
                onImagem={subir}
                onRecusa={setErro}
              />

              {estado?.ia.disponivel && (
                <div className="row row--top">
                  <input
                    type="text"
                    className="input"
                    placeholder="ou descreva para a IA criar: um gato programador…"
                    value={promptIa}
                    onChange={(e) => setPromptIa(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") criarImagem();
                    }}
                  />
                  <button
                    type="button"
                    className="button button--outline button--small"
                    disabled={promptIa.trim().length < 3 || ocupado === "ia"}
                    onClick={criarImagem}
                  >
                    <SparkIcon size={15} />
                    {ocupado === "ia" ? "Criando…" : "Criar"}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <strong className="step">
                <span className="step__num">2</span> Legenda
              </strong>
              <span
                className={`counter${usados > limites.maxCaracteres * 0.85 ? " counter--near" : ""}`}
              >
                {usados}/{limites.maxCaracteres}
              </span>
            </div>
            <div className="card__body">
              <textarea
                className="input input--block"
                rows={2}
                maxLength={limites.maxCaracteres}
                placeholder="Digite a legenda (opcional)"
                value={legenda}
                onChange={(e) => {
                  setLegenda(e.target.value);
                  invalidarRecorte();
                }}
              />

              {estado?.ia.disponivel && (
                <div className="row row--top">
                  <button
                    type="button"
                    className="button button--outline button--small"
                    disabled={!imagem || ocupado === "ia"}
                    onClick={pedirSugestoes}
                  >
                    <SparkIcon size={15} />
                    {ocupado === "ia" ? "Pensando…" : "Sugerir com IA"}
                  </button>
                </div>
              )}

              {sugestoes.length > 0 && (
                <div className="chips">
                  {sugestoes.map((sugestao) => (
                    <button
                      key={sugestao}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setLegenda(sugestao);
                        invalidarRecorte();
                      }}
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={`card${legenda.trim() ? "" : " card--dim"}`}>
            <div className="card__header">
              <strong className="step">
                <span className="step__num">3</span> Onde entra a legenda
              </strong>
            </div>
            <div className="card__body">
              <PositionPicker
                posicoes={posicoes}
                montagem={montagem}
                ajuste={ajuste}
                onPosicao={(id) => {
                  setPosicao(id);
                  invalidarRecorte();
                }}
                onAjuste={(novo) => {
                  setAjuste(novo);
                  invalidarRecorte();
                }}
              />
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <strong className="step">
                <span className="step__num">4</span> Para quem
              </strong>
            </div>
            <div className="card__body">
              <DestinationPicker
                destino={destino}
                conectado={conectado}
                onDestino={setDestino}
                onErro={setErro}
              />
            </div>
          </section>
        </div>

        {/* ----------------------------- palco ----------------------------- */}
        <div className="workbench__stage">
          <section className="card">
            <div className="card__body">
              <div className="checker">
                {previaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="checker__art"
                    src={figurinhaUrl ?? previaUrl}
                    alt="Prévia da figurinha"
                  />
                ) : (
                  <div className="checker__empty">
                    <span>Suba uma imagem para ver a prévia</span>
                  </div>
                )}
                {ocupado === "previa" && <div className="checker__busy" />}
              </div>
              <p className="checker__note">
                Prévia em 512×512 — é exatamente o arquivo que vai para o WhatsApp.
              </p>
            </div>
          </section>

          <button
            type="button"
            className="button button--brand button--cta"
            disabled={!podeRecortar}
            onClick={recortar}
          >
            <ScissorsIcon size={17} />
            {ocupado === "recorte" ? "Recortando…" : "Recortar e gerar figurinha"}
          </button>

          {figurinhaUrl && (
            <div className="done">
              <div className="done__info">
                <strong>Figurinha pronta</strong>
                <span>
                  512×512 · {figurinhaKb}KB ·{" "}
                  {ajuste === "preencher" ? "bordas cortadas" : "imagem inteira"}
                </span>
              </div>
              <a
                className="button button--outline button--small"
                href={figurinhaUrl}
                download="figurinha.webp"
              >
                <DownloadIcon size={16} />
                Baixar
              </a>
            </div>
          )}

          <section className="card">
            <div className="card__body send">
              <span className={`send__target${destino ? " send__target--set" : ""}`}>
                {destino
                  ? `${destino.tipo === "grupo" ? "Grupo" : "Contato"}: ${destino.nome}`
                  : "Nenhum destino escolhido"}
              </span>
              <button
                type="button"
                className="button button--brand"
                disabled={!podeEnviar}
                onClick={enviar}
              >
                <SendIcon size={16} />
                {ocupado === "envio" ? "Enviando…" : "Enviar no WhatsApp"}
              </button>
              {!figurinhaUrl && imagem && (
                <span className="send__hint">Recorte a figurinha antes de enviar.</span>
              )}
              {figurinhaUrl && !conectado && (
                <span className="send__hint">Conecte o WhatsApp no status acima.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
