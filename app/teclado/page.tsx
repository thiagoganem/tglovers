"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";

/**
 * Teclado de símbolos.
 *
 * Contorno simplificado com as teclas de pontuação que mais custam a achar.
 * Cada tecla tem dois níveis — o de cima é o que sai com Shift, o de baixo o
 * que sai solto — e as duas metades são alvos de clique do mesmo tamanho:
 * clicar em qualquer metade copia o símbolo que está nela.
 */

type Tecla = {
  /** O que a tecla solta, sem modifier. */
  base: string;
  /** O que sai com Shift — omitido quando a tecla não tem segundo nível. */
  shift?: string;
  /** Aparência de tecla mais larga (Enter, Shift…), para dar forma ao contorno. */
  largura?: number;
  /** Tecla fantasma: ocupa o lugar de uma tecla real que não interessa aqui. */
  fantasma?: boolean;
};

type Fileira = Tecla[];

const TECLADO: Fileira[] = [
  [
    { base: "`", shift: "~" },
    { base: "-", shift: "_" },
    { base: "=", shift: "+" },
    { base: "[", shift: "{" },
    { base: "]", shift: "}" },
    { base: "\\", shift: "|" },
  ],
  [{ base: "'", shift: '"' }, { base: ";", shift: ":" }, { largura: 4, base: "", fantasma: true }],
  [
    { base: ",", shift: "<" },
    { base: ".", shift: ">" },
    { base: "/", shift: "?", largura: 2 },
    { largura: 2, base: "", fantasma: true },
  ],
];

export default function Teclado() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const avisoRef = useRef<number | undefined>(undefined);

  // O aviso "Copiado!" some sozinho — tempo curto, de quem já viu.
  useEffect(() => () => window.clearTimeout(avisoRef.current), []);

  const copiar = useCallback(async (caractere: string) => {
    try {
      await navigator.clipboard.writeText(caractere);
      setFalhou(false);
      setCopiado(caractere);
      window.clearTimeout(avisoRef.current);
      avisoRef.current = window.setTimeout(() => setCopiado(null), 1600);
    } catch {
      setFalhou(true);
    }
  }, []);

  return (
    <div className="stack">
      <header className="modhead">
        <div>
          <h1>Teclado</h1>
          <p>Símbolos e pontuações difíceis de achar — um clique copia para a área de transferência.</p>
        </div>
      </header>

      <section className="card">
        {/* `role="status"`: leitores de tela anunciam sem roubar o foco. */}
        <div className="card__header teclado__barra">
          <span className="teclado__status" role="status" aria-live="polite">
            {falhou ? (
              "Não foi possível copiar."
            ) : copiado !== null ? (
              <>
                <CheckIcon size={15} />
                {`Copiado: ${copiado}`}
              </>
            ) : (
              ""
            )}
          </span>
        </div>

        <div className="teclado card__body">
          {TECLADO.map((fileira, indiceFileira) => (
            <div className="teclado__fileira" key={indiceFileira}>
              {fileira.map((tecla, indiceTecla) =>
                tecla.fantasma ? (
                  <span
                    className="tecla tecla--fantasma"
                    style={{ flexGrow: tecla.largura ?? 1 }}
                    key={indiceTecla}
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    className="tecla"
                    style={{ flexGrow: tecla.largura ?? 1 }}
                    key={indiceTecla}
                    role="group"
                    aria-label={`Tecla ${tecla.base}${tecla.shift ? ` / ${tecla.shift}` : ""}`}
                  >
                    {tecla.shift && (
                      // Metade de cima: o que sai com Shift. Mesmo tamanho que
                      // a de baixo — uma não pode atropelar a área da outra.
                      <button
                        type="button"
                        className={`tecla__metade${copiado === tecla.shift ? " tecla__metade--copiada" : ""}`}
                        onClick={() => void copiar(tecla.shift as string)}
                        title={`Copiar ${tecla.shift}`}
                        aria-label={`Copiar ${tecla.shift}`}
                      >
                        <span className="tecla__shift">{tecla.shift}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`tecla__metade${copiado === tecla.base ? " tecla__metade--copiada" : ""}`}
                      onClick={() => void copiar(tecla.base)}
                      title={`Copiar ${tecla.base}`}
                      aria-label={`Copiar ${tecla.base}`}
                    >
                      <span className="tecla__base">{tecla.base}</span>
                    </button>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>

        <p className="teclado__nota">
          Cada tecla traz os dois níveis: em cima o que sai com Shift, embaixo o que sai solto.
          Clique na metade do símbolo que quer copiar.
        </p>
      </section>
    </div>
  );
}
