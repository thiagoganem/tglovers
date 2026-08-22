"use client";

import { useEffect, useState } from "react";
import {
  descreverRestante,
  ELEICAO,
  formatarRestante,
  restante,
  situacao,
  type Restante,
  type Situacao,
} from "@/lib/eleicoes";

type Estado = { situacao: Situacao; restante: Restante | null };

function medir(): Estado {
  const agora = Date.now();
  const atual = situacao(agora);
  return { situacao: atual, restante: atual.alvo ? restante(atual.alvo, agora) : null };
}

/**
 * Contagem regressiva até o fechamento das urnas.
 *
 * O relógio só começa depois da montagem: o horário do servidor e o do
 * navegador nunca batem no mesmo segundo, e renderizar os dígitos no HTML
 * inicial daria erro de hidratação. Antes disso aparece só o rótulo, que é
 * estável nos dois lados.
 */
export function Countdown() {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    setEstado(medir());
    const timer = setInterval(() => setEstado(medir()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sem JS ou antes da montagem, `situacao(0)` devolve a fase de quem ainda
  // está esperando o dia — o rótulo já informa do que se trata.
  const atual = estado?.situacao ?? situacao(0);

  if (atual.fase === "encerrado") {
    return (
      <div className="countdown countdown--fim" title={`A votação terminou ${ELEICAO.extenso}.`}>
        <span className="countdown__label">Votação encerrada</span>
        <span className="countdown__clock">00:00:00</span>
      </div>
    );
  }

  const votando = atual.fase === "votando";
  const numeros = estado?.restante ?? null;

  return (
    <div
      className={`countdown${votando ? " countdown--votando" : ""}`}
      title={`As urnas fecham ${ELEICAO.extenso}.`}
    >
      <span className="countdown__label">
        {votando ? "Urnas fecham em" : `${ELEICAO.label} em`}
      </span>

      {/* Os dígitos mudam a cada segundo: fora da árvore de acessibilidade
          para não virar um leitor de tela tagarela. O resumo vem abaixo. */}
      <span className="countdown__clock" aria-hidden="true" suppressHydrationWarning>
        {numeros ? formatarRestante(numeros) : "—"}
      </span>

      {numeros && (
        <span className="visually-hidden">
          Faltam {descreverRestante(numeros)} para o fim da votação.
        </span>
      )}
    </div>
  );
}
