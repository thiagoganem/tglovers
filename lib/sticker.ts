/**
 * Cliente da API de figurinhas.
 *
 * Mesma convenção do cliente de documentos: as chamadas vão para `/api/*` no
 * mesmo domínio e quem encaminha é o rewrite do Next (dev) ou o nginx (VPS).
 * O serviço de figurinhas é Node — Baileys (WhatsApp) e a renderização com
 * sharp/canvas não têm equivalente no backend Python.
 */
const API_BASE = (process.env.NEXT_PUBLIC_STICKER_URL ?? "").replace(/\/$/, "");

const api = (path: string) => `${API_BASE}/api/sticker${path}`;

export type Posicao = {
  id: string;
  n: number;
  emoji: string;
  label: string;
  hint: string;
  /** `true` = a imagem inteira continua visível. */
  safe: boolean;
};

export type Ajuste = "ajustar" | "preencher";

export type EstadoWa = {
  conectado: boolean;
  conectando: boolean;
  usuario: { id: string; nome: string } | null;
  qr: string | null;
  codigoPareamento: string | null;
  motivo: string | null;
  precisaRelogar: boolean;
};

export type EstadoServico = {
  wa: EstadoWa;
  ia: { disponivel: boolean; estilo: boolean };
  fila: { running: number; waiting: number };
  posicoes: Posicao[];
  limites: { maxCaracteres: number; maxImagemBytes: number };
  conversas: number;
};

export type Conversa = {
  id: string;
  nome: string;
  tipo: "grupo" | "contato";
  telefone: string;
};

export type Montagem = {
  id: string;
  legenda: string;
  posicao: string;
  ajuste: Ajuste;
};

export class StickerError extends Error {}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(api(caminho), init);
  if (!res.ok) {
    let mensagem = `erro ${res.status}`;
    try {
      const corpo = (await res.json()) as { erro?: string };
      if (corpo?.erro) mensagem = corpo.erro;
    } catch {
      /* resposta sem json: fica a mensagem genérica */
    }
    throw new StickerError(mensagem);
  }
  return (await res.json()) as T;
}

async function pedirBlob(caminho: string, init: RequestInit = {}): Promise<Blob> {
  const res = await fetch(api(caminho), init);
  if (!res.ok) {
    let mensagem = `erro ${res.status}`;
    try {
      const corpo = (await res.json()) as { erro?: string };
      if (corpo?.erro) mensagem = corpo.erro;
    } catch {
      /* idem */
    }
    throw new StickerError(mensagem);
  }
  return res.blob();
}

const comJson = (corpo: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(corpo),
  signal,
});

export const fetchEstado = (signal?: AbortSignal) =>
  pedir<EstadoServico>("/estado", { signal, cache: "no-store" });

export const fetchConversas = (q: string, signal?: AbortSignal) =>
  pedir<{ conversas: Conversa[] }>(`/conversas?q=${encodeURIComponent(q)}`, {
    signal,
    cache: "no-store",
  }).then((r) => r.conversas);

export const resolverNumero = (numero: string) =>
  pedir<{ conversa: Conversa }>("/conversas/numero", comJson({ numero })).then((r) => r.conversa);

export const enviarImagem = (arquivo: File | Blob) =>
  pedir<{ id: string; largura: number; altura: number }>("/upload", {
    method: "POST",
    body: arquivo,
  });

export const gerarPrevia = (m: Montagem, tamanho: number, signal?: AbortSignal) =>
  pedirBlob("/previa", comJson({ ...m, tamanho }, signal));

export const gerarFigurinha = (m: Montagem) => pedirBlob("/figurinha", comJson(m));

export const enviarFigurinha = (m: Montagem, destino: string) =>
  pedir<{ ok: true; destino: { id: string; nome: string }; kb: number; cortou: boolean }>(
    "/enviar",
    comJson({ ...m, destino }),
  );

export const sugerirLegendas = (id: string) =>
  pedir<{ sugestoes: string[] }>("/ia/legendas", comJson({ id })).then((r) => r.sugestoes);

export const criarComIa = (prompt: string) =>
  pedir<{ id: string; largura: number; altura: number }>("/ia/criar", comJson({ prompt }));

export const estilizarComIa = (id: string, prompt = "") =>
  pedir<{ id: string; largura: number; altura: number }>("/ia/estilo", comJson({ id, prompt }));

export const descartarImagem = (id: string) =>
  fetch(api("/descartar"), comJson({ id })).catch(() => undefined);
