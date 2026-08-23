"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Palco } from "@/components/perfil/Palco";
import { AlertIcon, CheckIcon, ImageIcon, ShareIcon, TargetIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import {
  carregarImagem,
  ENQUADRAMENTO_PADRAO,
  entregar,
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
 * site. É a única possível e entra sozinha com a foto: quem chega aqui vem
 * apoiar esta campanha, e não escolher figurinha.
 */
const SELO_URL = "/selo.png";

const MAX_FOTO = 25 * 1024 * 1024;

export default function Perfil() {
  const [foto, setFoto] = useState<Camada | null>(null);
  const [selo, setSelo] = useState<Camada | null>(null);
  const [seloFalhou, setSeloFalhou] = useState(false);

  const [enquadramento, setEnquadramento] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO);
  const [posicaoSelo, setPosicaoSelo] = useState<PosicaoSelo>(SELO_PADRAO);
  const [formato, setFormato] = useState<Formato>("redondo");

  const [erro, setErro] = useState<string | null>(null);
  const [entregando, setEntregando] = useState(false);
  //: Vira aviso curto depois de entregar — só quando o arquivo caiu na pasta
  //: de downloads em vez de ir para um aplicativo, que é o caso em que a
  //: pessoa precisa saber onde procurar.
  const [baixou, setBaixou] = useState(false);
  const entradaRef = useRef<HTMLInputElement>(null);

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
    async (arquivo: File | undefined | null) => {
      if (!arquivo) return;
      if (!arquivo.type.startsWith("image/")) {
        setErro("Isso não parece uma imagem. Envie JPG, PNG ou WEBP.");
        return;
      }
      if (arquivo.size > MAX_FOTO) {
        setErro(
          `Imagem de ${formatBytes(arquivo.size)} — o limite é ${formatBytes(MAX_FOTO)}.`,
        );
        return;
      }

      setErro(null);
      try {
        const camada = await carregarImagem(arquivo);
        setFoto(camada);
        // Foto nova, enquadramento novo: manter o zoom da anterior quase
        // sempre corta o rosto no lugar errado.
        setEnquadramento(ENQUADRAMENTO_PADRAO);
        setPosicaoSelo(posicaoInicialSelo(selo));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível abrir esta imagem.");
      }
    },
    [selo],
  );

  // Ctrl+V vale na página inteira: é o caminho mais curto para quem acabou de
  // recortar a foto em outro lugar.
  useEffect(() => {
    const aoColar = (evento: ClipboardEvent) => {
      const item = Array.from(evento.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) void receberFoto(item.getAsFile());
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [receberFoto]);

  const montagem: Montagem = useMemo(
    () => ({ foto, selo, enquadramento, posicaoSelo, formato }),
    [enquadramento, formato, foto, posicaoSelo, selo],
  );

  // Comparação por valor, não por referência: cada gesto produz objetos novos,
  // e um `!==` acusaria mudança mesmo com a montagem de volta no lugar.
  const inicial = useMemo(() => posicaoInicialSelo(selo), [selo]);
  const mexido =
    enquadramento.zoom !== ENQUADRAMENTO_PADRAO.zoom ||
    enquadramento.panX !== ENQUADRAMENTO_PADRAO.panX ||
    enquadramento.panY !== ENQUADRAMENTO_PADRAO.panY ||
    posicaoSelo.escala !== inicial.escala ||
    posicaoSelo.x !== inicial.x ||
    posicaoSelo.y !== inicial.y;

  const recomecar = () => {
    setEnquadramento(ENQUADRAMENTO_PADRAO);
    setPosicaoSelo(inicial);
  };

  const compartilhar = async () => {
    setErro(null);
    setBaixou(false);
    setEntregando(true);
    try {
      setBaixou((await entregar(montagem, formato)) === "baixado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setEntregando(false);
    }
  };

  const escolher = () => entradaRef.current?.click();

  return (
    <div className="stack">
      <header className="modhead">
        <div>
          <h1>Foto de perfil</h1>
          <p>Sua foto com o selo da campanha, pronta para o WhatsApp e o Instagram.</p>
        </div>
      </header>

      {erro && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: 18 }}>
          <AlertIcon />
          <span>{erro}</span>
        </div>
      )}

      {seloFalhou && (
        <div className="alert alert--danger" role="alert" style={{ marginBottom: 18 }}>
          <AlertIcon />
          <span>
            A arte da campanha não carregou. Atualize a página — sem ela não dá para montar
            o apoio.
          </span>
        </div>
      )}

      <input
        ref={entradaRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(e) => {
          void receberFoto(e.target.files?.[0]);
          e.target.value = ""; // permite reescolher o mesmo arquivo
        }}
      />

      <section className="card montagem">
        <div className="card__body">
          <div
            className="montagem__palco"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void receberFoto(e.dataTransfer?.files?.[0]);
            }}
          >
            <Palco
              montagem={montagem}
              onEnquadramento={setEnquadramento}
              onPosicaoSelo={setPosicaoSelo}
            />

            {foto && mexido && (
              <button
                type="button"
                className="icon-button montagem__reset"
                onClick={recomecar}
                aria-label="Voltar ao enquadramento inicial"
                title="Voltar ao enquadramento inicial"
              >
                <TargetIcon />
              </button>
            )}
          </div>

          {foto ? (
            <>
              <p className="montagem__dica">
                Arraste para mover · dois dedos ou a roda do mouse para o tamanho · vale
                para a foto e para o selo
              </p>

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

              <div className="montagem__acoes">
                <button
                  type="button"
                  className="button button--cta montagem__baixar"
                  disabled={entregando}
                  onClick={compartilhar}
                >
                  <ShareIcon />
                  {entregando ? "Preparando…" : "Compartilhar"}
                </button>
                <button type="button" className="button button--outline" onClick={escolher}>
                  Trocar foto
                </button>
              </div>

              {baixou ? (
                <p className="montagem__saida" role="status">
                  <CheckIcon />
                  Este navegador não abre a lista de aplicativos — a imagem foi salva nos
                  seus downloads. Mande por lá.
                </p>
              ) : (
                <p className="palco__nota">
                  {TAMANHO_EXPORTACAO} × {TAMANHO_EXPORTACAO} px · PNG · a montagem
                  acontece no seu aparelho
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="button button--cta montagem__baixar"
                onClick={escolher}
              >
                <ImageIcon size={18} />
                Escolher minha foto
              </button>
              <p className="palco__nota">
                ou arraste aqui · Ctrl+V para colar · a montagem acontece no seu aparelho
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
