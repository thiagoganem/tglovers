/**
 * Data da eleição usada pela contagem regressiva do topo.
 *
 * **Um turno só.** A contagem é para deputado federal, cargo de eleição
 * proporcional — não existe segundo turno. (Segundo turno só acontece em
 * disputas majoritárias: presidente, governador e prefeito de cidade grande.)
 * Por isso a contagem tem um alvo único e simplesmente para em zero.
 *
 * O instante é absoluto, com o fuso de Brasília (UTC-3) escrito no próprio
 * texto: quem abrir o dashboard de outro fuso vê o mesmo alvo, e não um horário
 * deslocado. O Brasil não tem horário de verão desde 2019, então o deslocamento
 * fixo é seguro.
 *
 * Eleições gerais de 2026: votação em 4 de outubro, um domingo, das 8h às 17h.
 */
export const ELEICAO = {
  label: "Eleições 2026",
  /** Abertura das urnas. */
  abertura: "2026-10-04T08:00:00-03:00",
  /** Fechamento das urnas — é este o alvo da contagem. */
  fechamento: "2026-10-04T17:00:00-03:00",
  /** Texto longo, exibido ao passar o mouse. */
  extenso: "domingo, 4 de outubro de 2026, às 17h de Brasília",
} as const;

export type Fase =
  /** Ainda falta chegar o dia. */
  | "aguardando"
  /** É hoje e as urnas estão abertas. */
  | "votando"
  /** A votação acabou. */
  | "encerrado";

export type Situacao = {
  fase: Fase;
  /** Instante alvo em milissegundos, ou `null` depois do fechamento. */
  alvo: number | null;
};

export function situacao(agora: number = Date.now()): Situacao {
  const fechamento = Date.parse(ELEICAO.fechamento);
  if (agora >= fechamento) return { fase: "encerrado", alvo: null };

  const abertura = Date.parse(ELEICAO.abertura);
  return { fase: agora >= abertura ? "votando" : "aguardando", alvo: fechamento };
}

export type Restante = {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  /** Milissegundos que faltam; nunca negativo. */
  total: number;
};

/** Quebra a diferença em dias/horas/minutos/segundos, sem passar de zero. */
export function restante(alvo: number, agora: number = Date.now()): Restante {
  const total = Math.max(0, alvo - agora);
  const segundosTotais = Math.floor(total / 1000);
  return {
    dias: Math.floor(segundosTotais / 86_400),
    horas: Math.floor((segundosTotais % 86_400) / 3_600),
    minutos: Math.floor((segundosTotais % 3_600) / 60),
    segundos: segundosTotais % 60,
    total,
  };
}

const dois = (n: number) => String(n).padStart(2, "0");

/** `45d 16:59:32` — compacto o bastante para caber na barra do topo. */
export function formatarRestante({ dias, horas, minutos, segundos }: Restante): string {
  const relogio = `${dois(horas)}:${dois(minutos)}:${dois(segundos)}`;
  return dias > 0 ? `${dias}d ${relogio}` : relogio;
}

/** Versão por extenso, para leitores de tela. */
export function descreverRestante(r: Restante): string {
  const partes: string[] = [];
  if (r.dias) partes.push(`${r.dias} ${r.dias === 1 ? "dia" : "dias"}`);
  if (r.horas) partes.push(`${r.horas} ${r.horas === 1 ? "hora" : "horas"}`);
  if (r.minutos) partes.push(`${r.minutos} ${r.minutos === 1 ? "minuto" : "minutos"}`);
  if (!partes.length) partes.push(`${r.segundos} ${r.segundos === 1 ? "segundo" : "segundos"}`);
  return partes.join(", ");
}
