"use client";

import { useEffect, useRef, useState } from "react";
import { gerarPrevia, type Ajuste, type Montagem, type Posicao } from "@/lib/sticker";

type PositionPickerProps = {
  posicoes: Posicao[];
  montagem: Montagem | null;
  ajuste: Ajuste;
  onPosicao: (id: string) => void;
  onAjuste: (ajuste: Ajuste) => void;
};

const TAMANHO = 176;

/**
 * As quatro posições possíveis da legenda, cada uma renderizada com a imagem e
 * o texto reais — não é ilustração, é a figurinha em miniatura. Abaixo, o
 * enquadramento: "Ajustar" preserva a imagem inteira, "Preencher" corta as
 * bordas de propósito.
 */
export function PositionPicker({
  posicoes,
  montagem,
  ajuste,
  onPosicao,
  onAjuste,
}: PositionPickerProps) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const urlsRef = useRef<string[]>([]);

  // Chave estável: só refaz as miniaturas quando algo que aparece nelas muda.
  const chave = montagem ? `${montagem.id}|${montagem.legenda}|${montagem.ajuste}` : "";

  useEffect(() => {
    if (!montagem) {
      setThumbs({});
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const novas: Record<string, string> = {};
      for (const posicao of posicoes) {
        try {
          // Em série: são quatro imagens pequenas e a fila do serviço é curta.
          // eslint-disable-next-line no-await-in-loop
          const blob = await gerarPrevia(
            { ...montagem, posicao: posicao.id },
            TAMANHO,
            controller.signal,
          );
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          novas[posicao.id] = url;
        } catch {
          /* miniatura é apoio visual: se falhar, o cartão fica sem imagem */
        }
      }
      if (!controller.signal.aborted) setThumbs(novas);
    }, 380);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, posicoes]);

  // Libera os object URLs acumulados quando o componente sai de cena.
  useEffect(
    () => () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    },
    [],
  );

  return (
    <>
      <div className="positions">
        {posicoes.map((posicao) => {
          const ativa = montagem?.posicao === posicao.id;
          return (
            <button
              key={posicao.id}
              type="button"
              className={`position${ativa ? " position--active" : ""}`}
              aria-pressed={ativa}
              onClick={() => onPosicao(posicao.id)}
            >
              <span className="position__frame">
                {thumbs[posicao.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbs[posicao.id]} alt="" />
                ) : null}
              </span>
              <span className="position__label">{posicao.label}</span>
              <span className={`position__hint${posicao.safe ? "" : " position__hint--warn"}`}>
                {posicao.safe ? "✓" : "!"} {posicao.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="segmented" role="group" aria-label="Enquadramento">
        <button
          type="button"
          className={`segmented__option${ajuste === "ajustar" ? " segmented__option--active" : ""}`}
          aria-pressed={ajuste === "ajustar"}
          onClick={() => onAjuste("ajustar")}
        >
          Ajustar
          <em>não corta nada</em>
        </button>
        <button
          type="button"
          className={`segmented__option${ajuste === "preencher" ? " segmented__option--active" : ""}`}
          aria-pressed={ajuste === "preencher"}
          onClick={() => onAjuste("preencher")}
        >
          Preencher
          <em>corta as bordas</em>
        </button>
      </div>
    </>
  );
}
