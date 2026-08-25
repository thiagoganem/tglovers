"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";

/**
 * Teclado de símbolos — Windows × Mac.
 *
 * O contorno é simplificado de propósito: só as teclas cujo símbolo costuma
 * trocar de lugar (ou de atalho) entre um teclado ABNT2 de Windows e o layout
 * brasileiro do Mac. Clicar copia o caractere; o rótulo menor da tecla (o que
 * sai com Shift) também é clicável, por conta própria.
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

type Sistema = "windows" | "mac";

const LAYOUTS: Record<Sistema, Fileira[]> = {
  // ABNT2 simplificado: `/ ?` mora na fileira de baixo, ao lado do Shift
  // direito, e `\ |` abre a fileira de baixo, à esquerda do Z.
  windows: [
    [
      { base: "`", shift: "~" },
      { base: "-", shift: "_" },
      { base: "=", shift: "+" },
      { base: "[", shift: "{" },
      { base: "]", shift: "}" },
    ],
    [{ base: "'", shift: '"' }, { base: ";", shift: ":" }, { largura: 3, base: "", fantasma: true }],
    [
      { base: "\\", shift: "|" },
      { base: ",", shift: "<" },
      { base: ".", shift: ">" },
      { base: "/", shift: "?", largura: 2 },
      { largura: 2, base: "", fantasma: true },
    ],
  ],
  // Layout brasileiro da Apple: `? /` sobe para a tecla ao lado do `1` (sem
  // Shift), e `\ |` passa para a fileira do meio, ao lado do Return.
  mac: [
    [
      { base: "?", shift: "/" },
      { base: "`", shift: "~" },
      { base: "-", shift: "_" },
      { base: "=", shift: "+" },
      { base: "[", shift: "{" },
      { base: "]", shift: "}" },
    ],
    [
      { base: "'", shift: '"' },
      { base: ";", shift: ":" },
      { base: "\\", shift: "|", largura: 2 },
      { largura: 2, base: "", fantasma: true },
    ],
    [
      { base: ",", shift: "<" },
      { base: ".", shift: ">" },
      { largura: 4, base: "", fantasma: true },
    ],
  ],
};

/** Nota de uma linha por sistema — o porquê de as teclas dançarem. */
const NOTAS: Record<Sistema, string> = {
  windows: "ABNT2: ? é Shift da tecla / (ao lado do Shift direito) e \\ abre a fileira de baixo.",
  mac: "Mac brasileiro: ? mora ao lado do 1, sem Shift. No ABNT2 via hardware americano, ? é ⌥ W e \\ é ⌥ Ç.",
};

export default function Teclado() {
  const [sistema, setSistema] = useState<Sistema>("windows");
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

  const fileiras = LAYOUTS[sistema];

  return (
    <div className="stack">
      <header className="modhead">
        <div>
          <h1>Teclado</h1>
          <p>Símbolos que trocam de lugar entre Windows e Mac — clique para copiar.</p>
        </div>
      </header>

      <section className="card">
        <div className="card__header teclado__barra">
          <div className="tabs" role="tablist" aria-label="Sistema do teclado">
            {(["windows", "mac"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="tab"
                aria-selected={sistema === opcao}
                className={`tab${sistema === opcao ? " tab--active" : ""}`}
                onClick={() => setSistema(opcao)}
              >
                {opcao === "windows" ? "Windows" : "Mac"}
              </button>
            ))}
          </div>

          {/* `role="status"`: leitores de tela anunciam sem roubar o foco. */}
          <span className="teclado__status" role="status" aria-live="polite">
            {falhou ? (
              "Não foi possível copiar."
            ) : copiado !== null ? (
              <>
                <CheckIcon size={15} />
                {copiado === " " ? "espaço" : `Copiado: ${copiado}`}
              </>
            ) : (
              ""
            )}
          </span>
        </div>

        <div className="teclado card__body">
          {fileiras.map((fileira, indiceFileira) => (
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
                  <button
                    type="button"
                    className={`tecla${
                      copiado !== null && (copiado === tecla.base || copiado === tecla.shift)
                        ? " tecla--copiada"
                        : ""
                    }`}
                    style={{ flexGrow: tecla.largura ?? 1 }}
                    key={indiceTecla}
                    onClick={() => void copiar(tecla.base)}
                    title={`Copiar ${tecla.base}`}
                    aria-label={`Copiar ${tecla.base}`}
                  >
                    <span className="tecla__base">{tecla.base}</span>
                    {tecla.shift && (
                      // O segundo nível copia por conta própria: clicar nele não
                      // pode disparar o clique da tecla inteira.
                      <span
                        className="tecla__shift"
                        role="button"
                        tabIndex={0}
                        title={`Copiar ${tecla.shift}`}
                        aria-label={`Copiar ${tecla.shift}`}
                        onClick={(evento) => {
                          evento.stopPropagation();
                          void copiar(tecla.shift as string);
                        }}
                        onKeyDown={(evento) => {
                          if (evento.key === "Enter" || evento.key === " ") {
                            evento.preventDefault();
                            evento.stopPropagation();
                            void copiar(tecla.shift as string);
                          }
                        }}
                      >
                        {tecla.shift}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          ))}
        </div>

        <p className="teclado__nota">{NOTAS[sistema]}</p>
      </section>
    </div>
  );
}
