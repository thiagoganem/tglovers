"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagemDrop } from "@/components/perfil/ImagemDrop";
import { Palco } from "@/components/perfil/Palco";
import { AlertIcon, DownloadIcon, ImageIcon, TargetIcon } from "@/components/icons";
import {
  carregarImagem,
  ENQUADRAMENTO_PADRAO,
  exportarPng,
  limitarEnquadramento,
  limitarPosicaoSelo,
  LIMITE_ESCALA_SELO,
  LIMITE_ZOOM,
  nomeArquivo,
  posicaoInicialSelo,
  SELO_PADRAO,
  TAMANHO_EXPORTACAO,
  type Camada,
  type Enquadramento,
  type Formato,
  type Montagem,
  type PosicaoSelo,
} from "@/lib/perfil";

/**
 * A arte da campanha, gerada por `marca/gerar-selo.py` e servida junto com o
 * site. É a única possível: quem entra aqui vem apoiar esta campanha, e um
 * campo de envio só abriria espaço para colar qualquer outra coisa por cima do
 * rosto de quem apoia.
 */
const SELO_URL = "/selo.png";

const MAX_FOTO = 25 * 1024 * 1024;

/** Guarda um object URL e libera o anterior — sem vazar memória entre trocas. */
function useObjectUrl() {
  const atual = useRef<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const trocar = useCallback((arquivo: Blob | null) => {
    if (atual.current) URL.revokeObjectURL(atual.current);
    const novo = arquivo ? URL.createObjectURL(arquivo) : null;
    atual.current = novo;
    setUrl(novo);
  }, []);

  useEffect(
    () => () => {
      if (atual.current) URL.revokeObjectURL(atual.current);
    },
    [],
  );

  return [url, trocar] as const;
}

export default function Perfil() {
  const [foto, setFoto] = useState<Camada | null>(null);
  const [selo, setSelo] = useState<Camada | null>(null);
  const [seloFalhou, setSeloFalhou] = useState(false);

  const [fotoThumb, trocarFotoThumb] = useObjectUrl();

  const [enquadramento, setEnquadramento] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO);
  const [posicaoSelo, setPosicaoSelo] = useState<PosicaoSelo>(SELO_PADRAO);
  const [formato, setFormato] = useState<Formato>("redondo");

  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  // O selo vem junto com o site e entra sozinho: não há nada para o usuário
  // escolher aqui, só a foto dele.
  useEffect(() => {
    let cancelado = false;
    carregarImagem(SELO_URL)
      .then((camada) => {
        if (cancelado) return;
        setSelo(camada);
        setPosicaoSelo(posicaoInicialSelo(camada));
      })
      .catch(() => {
        if (!cancelado) setSeloFalhou(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const receberFoto = useCallback(
    async (arquivo: File) => {
      setErro(null);
      try {
        const camada = await carregarImagem(arquivo);
        setFoto(camada);
        trocarFotoThumb(arquivo);
        // Foto nova, enquadramento novo: manter o zoom da anterior quase
        // sempre corta o rosto no lugar errado.
        setEnquadramento(ENQUADRAMENTO_PADRAO);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível abrir esta imagem.");
      }
    },
    [trocarFotoThumb],
  );

  const montagem: Montagem = useMemo(
    () => ({ foto, selo, enquadramento, posicaoSelo, formato }),
    [enquadramento, formato, foto, posicaoSelo, selo],
  );

  const baixar = async () => {
    setErro(null);
    setBaixando(true);
    try {
      const blob = await exportarPng(montagem);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo(formato);
      link.click();
      // Espera o navegador iniciar o download antes de invalidar a URL.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="stack stack--wide">
      <header className="modhead">
        <div>
          <h1>Foto de perfil</h1>
          <p>
            Sua foto com o selo da campanha, recortada em círculo para o WhatsApp e o
            Instagram.
          </p>
        </div>
      </header>

      {erro && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: 18 }}>
          <AlertIcon />
          <span>{erro}</span>
        </div>
      )}

      <div className="alert alert--info" style={{ marginBottom: 18 }}>
        <ImageIcon size={17} />
        <span>
          Nada sai do seu aparelho: a montagem acontece aqui no navegador, e a foto não é
          enviada para servidor nenhum.
        </span>
      </div>

      <div className="workbench">
        {/* --------------------------- controles --------------------------- */}
        <div className="workbench__controls">
          <section className="card">
            <div className="card__header">
              <strong className="step">
                <span className="step__num">1</span> Sua foto
              </strong>
            </div>
            <div className="card__body">
              <ImagemDrop
                titulo={foto ? "Foto escolhida" : "Arraste sua foto aqui"}
                subtitulo="ou clique para escolher · Ctrl+V para colar"
                legenda={foto ? `${foto.largura} × ${foto.altura}px` : undefined}
                thumb={fotoThumb}
                maxBytes={MAX_FOTO}
                icone={<ImageIcon size={24} />}
                aceitarColar
                onImagem={receberFoto}
                onErro={setErro}
              />

              <div className="controle">
                <label htmlFor="zoom">
                  Aproximação <span>{enquadramento.zoom.toFixed(1)}×</span>
                </label>
                <input
                  id="zoom"
                  type="range"
                  min={LIMITE_ZOOM.min}
                  max={LIMITE_ZOOM.max}
                  step={0.02}
                  value={enquadramento.zoom}
                  disabled={!foto}
                  onChange={(e) =>
                    setEnquadramento((atual) =>
                      // O limite do arrasto depende do zoom: reduzir sem
                      // reaplicar deixaria a foto fora do quadro.
                      limitarEnquadramento({ ...atual, zoom: Number(e.target.value) }, foto),
                    )
                  }
                />
              </div>

              <div className="row row--top">
                <button
                  type="button"
                  className="button button--outline button--small"
                  disabled={!foto}
                  onClick={() => setEnquadramento(ENQUADRAMENTO_PADRAO)}
                >
                  <TargetIcon />
                  Recentrar
                </button>
                <span className="dica">Arraste a foto na prévia para reenquadrar.</span>
              </div>
            </div>
          </section>

          <section className={`card${foto ? "" : " card--dim"}`}>
            <div className="card__header">
              <strong className="step">
                <span className="step__num">2</span> O selo
              </strong>
            </div>
            <div className="card__body">
              {seloFalhou ? (
                <div className="alert alert--danger" role="alert">
                  <AlertIcon />
                  <span>
                    A arte da campanha não carregou. Atualize a página — sem ela não dá para
                    montar o apoio.
                  </span>
                </div>
              ) : (
                <div className="selo-fixo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="imagedrop__thumb checker" src={SELO_URL} alt="" />
                  <div className="imagedrop__meta">
                    <strong>Selo da campanha</strong>
                    <span>entra sozinho, com o fundo já vazado</span>
                  </div>
                </div>
              )}

              <div className="controle">
                <label htmlFor="selo-tamanho">
                  Tamanho <span>{Math.round(posicaoSelo.escala * 100)}%</span>
                </label>
                <input
                  id="selo-tamanho"
                  type="range"
                  min={LIMITE_ESCALA_SELO.min}
                  max={LIMITE_ESCALA_SELO.max}
                  step={0.01}
                  value={posicaoSelo.escala}
                  disabled={!selo}
                  onChange={(e) =>
                    setPosicaoSelo((atual) =>
                      limitarPosicaoSelo({ ...atual, escala: Number(e.target.value) }),
                    )
                  }
                />
              </div>

              <div className="controle">
                <label htmlFor="selo-altura">
                  Altura <span>{Math.round(posicaoSelo.y * 100)}%</span>
                </label>
                <input
                  id="selo-altura"
                  type="range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={posicaoSelo.y}
                  disabled={!selo}
                  onChange={(e) =>
                    setPosicaoSelo((atual) =>
                      limitarPosicaoSelo({ ...atual, y: Number(e.target.value) }),
                    )
                  }
                />
              </div>

              <div className="row row--top">
                <button
                  type="button"
                  className="button button--outline button--small"
                  disabled={!selo}
                  onClick={() => setPosicaoSelo(posicaoInicialSelo(selo))}
                >
                  <TargetIcon />
                  Centralizar abaixo do rosto
                </button>
                <span className="dica">Ou arraste o selo direto na prévia.</span>
              </div>
            </div>
          </section>

          <section className={`card${foto ? "" : " card--dim"}`}>
            <div className="card__header">
              <strong className="step">
                <span className="step__num">3</span> Como salvar
              </strong>
            </div>
            <div className="card__body">
              <div className="segmented">
                <button
                  type="button"
                  className={`segmented__option${formato === "redondo" ? " segmented__option--active" : ""}`}
                  onClick={() => setFormato("redondo")}
                >
                  Redondo
                  <em>foto de perfil</em>
                </button>
                <button
                  type="button"
                  className={`segmented__option${formato === "quadrado" ? " segmented__option--active" : ""}`}
                  onClick={() => setFormato("quadrado")}
                >
                  Quadrado
                  <em>post e status</em>
                </button>
              </div>

              <p className="dica dica--bloco">
                {formato === "redondo"
                  ? "Fora do círculo o PNG sai transparente, que é como o WhatsApp e o Instagram recortam a foto de perfil."
                  : "O quadrado inteiro é a sua foto — bom para publicar como post ou status."}
              </p>
            </div>
          </section>
        </div>

        {/* ----------------------------- palco ----------------------------- */}
        <div className="workbench__stage">
          <section className="card">
            <div className="card__body">
              <Palco
                montagem={montagem}
                onEnquadramento={setEnquadramento}
                onPosicaoSelo={setPosicaoSelo}
              />

              <button
                type="button"
                className="button button--cta"
                style={{ width: "100%", marginTop: 16 }}
                disabled={!foto || baixando}
                onClick={baixar}
              >
                <DownloadIcon />
                {baixando ? "Gerando…" : "Baixar PNG"}
              </button>

              <p className="palco__nota">
                {TAMANHO_EXPORTACAO} × {TAMANHO_EXPORTACAO} px · PNG
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
