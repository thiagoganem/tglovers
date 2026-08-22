/**
 * Cliente da API.
 *
 * Dois modos, decididos por `NEXT_PUBLIC_API_URL`:
 *
 * * **vazio (padrão)** — as chamadas vão para `/api/*` no mesmo domínio, e quem
 *   encaminha para o backend é o nginx (VPS) ou o rewrite do Next (dev,
 *   Railway). Sem CORS no caminho.
 * * **definido** — o navegador fala direto com o backend, sem intermediário.
 *   É o modo indicado quando o frontend está na Vercel: nada trafega por um
 *   proxy com limite de tamanho ou de tempo. Exige liberar o domínio do
 *   frontend em `DOCOCR_CORS_ORIGINS` no backend.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Monta a URL de um endpoint respeitando o modo configurado. */
function api(path: string): string {
  return `${API_BASE}${path}`;
}

export type ServerConfig = {
  maxUploadBytes: number;
  targetBytes: number;
  maxPages: number;
  acceptedExtensions: string[];
  acceptedLabels: string[];
  languages: string[];
  lowConfidenceThreshold: number;
  /** Quantos arquivos cabem em um envio. */
  maxFiles: number;
};

export type ProcessWarning = { code: string; message: string };

export type ProcessResult = {
  id: string;
  filename: string;
  sourceFormat: string;
  pages: number;
  originalSize: number;
  finalSize: number;
  reductionPercent: number;
  withinTarget: boolean;
  ocrApplied: boolean;
  ocrPages: number;
  confidence: number | null;
  characters: number;
  text: string;
  /** Sobe a cada correção aplicada — usado para furar o cache da prévia. */
  version: number;
  warnings: ProcessWarning[];
};

export type RefineResult = {
  /** Quantos trechos foram reescritos no PDF. */
  applied: number;
  /** Trechos que caíram em texto visível (onde o desenho pode mudar). */
  visibleText: number;
  /** Destes, quantos não puderam manter a fonte original. */
  fontChanged: number;
  /** Quantos tiveram de encolher para caber no espaço da linha. */
  sizeReduced: number;
  /** O pedido era grande demais e foi cortado. */
  truncated: boolean;
  finalSize: number;
  version: number;
  /** O texto do PDF já corrigido — o editor passa a exibir este. */
  text: string;
};

export type ProgressState = {
  stage: string;
  percent: number;
  message: string;
  done: boolean;
  error?: string | null;
  /** Código estável do erro, quando houve. */
  errorCode?: string | null;
  /** O resultado, presente só quando `done` e sem erro. */
  result?: ProcessResult | null;
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const GENERIC_ERROR = "Não foi possível concluir o processamento. Tente novamente.";

function parseError(body: string, status: number): ApiError {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error?.message) {
      return new ApiError(parsed.error.code ?? "error", parsed.error.message);
    }
  } catch {
    /* resposta não-JSON: cai no genérico */
  }
  return new ApiError(status === 413 ? "file_too_large" : "error", GENERIC_ERROR);
}

export async function fetchConfig(): Promise<ServerConfig> {
  const response = await fetch(api("/api/config"), { cache: "no-store" });
  if (!response.ok) throw parseError(await response.text(), response.status);
  return response.json();
}

export async function fetchProgress(jobId: string): Promise<ProgressState> {
  const response = await fetch(api(`/api/progress/${jobId}`), { cache: "no-store" });
  if (!response.ok) throw parseError(await response.text(), response.status);
  return response.json();
}

export type ProcessOptions = {
  language: string;
  forceOcr: boolean;
  alwaysCompress: boolean;
  jobId: string;
  /** Progresso real do upload, de 0 a 1. */
  onUploadProgress?: (fraction: number) => void;
  /** Estágio do processamento no servidor, a cada sondagem. */
  onStage?: (progress: ProgressState) => void;
  /** Permite cancelar o envio. */
  signal?: AbortSignal;
};

/** Intervalo entre sondagens de progresso. */
const POLL_MS = 500;

/**
 * Quantas sondagens seguidas podem falhar por rede antes de desistir.
 *
 * Uma sondagem perdida não significa nada — a próxima cobre. Um minuto inteiro
 * delas significa que o servidor sumiu, e aí insistir só deixa o usuário
 * olhando uma barra que não anda.
 */
const FALHAS_TOLERADAS = 120;

function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new ApiError("aborted", "Envio cancelado."));
    });
  });
}

/**
 * Envia os arquivos e acompanha o processamento até o fim.
 *
 * Mais de um arquivo vira um PDF só, costurado na ordem da lista — é assim que
 * se anexa uma foto ao fim de um contrato.
 *
 * São duas etapas, e a separação é o ponto: o envio termina assim que os bytes
 * sobem (o servidor responde 202 com o identificador do trabalho), e o
 * processamento é acompanhado por sondagens curtas. Antes era uma requisição
 * só, aberta do primeiro byte até a última página do OCR — uma conexão parada
 * por minutos, que qualquer proxy no caminho pode cortar sem aviso.
 */
export async function processFiles(
  files: File[],
  options: ProcessOptions,
): Promise<ProcessResult> {
  await enviarArquivos(files, options);
  return acompanhar(options);
}

/**
 * Sonda o progresso até o trabalho terminar, e devolve o resultado.
 *
 * O resultado chega pelo próprio progresso: como o envio responde antes de
 * processar, não existe outra resposta onde ele caiba.
 */
async function acompanhar(options: ProcessOptions): Promise<ProcessResult> {
  let falhas = 0;

  for (;;) {
    if (options.signal?.aborted) throw new ApiError("aborted", "Envio cancelado.");

    try {
      const progress = await fetchProgress(options.jobId);
      falhas = 0;
      options.onStage?.(progress);

      if (progress.error) {
        throw new ApiError(progress.errorCode ?? "error", progress.error);
      }
      if (progress.done) {
        if (progress.result) return progress.result;
        throw new ApiError("invalid_response", GENERIC_ERROR);
      }
    } catch (caught) {
      // Erro relatado pelo servidor é definitivo; falha de rede é passageira.
      if (caught instanceof ApiError && caught.code !== "network_error") throw caught;
      if ((falhas += 1) > FALHAS_TOLERADAS) {
        throw new ApiError("network_error", "Falha de conexão com o servidor.");
      }
    }

    await esperar(POLL_MS, options.signal);
  }
}

/** Sobe os bytes e devolve quando o servidor aceita o trabalho. */
function enviarArquivos(files: File[], options: ProcessOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("language", options.language);
    form.append("force_ocr", String(options.forceOcr));
    form.append("always_compress", String(options.alwaysCompress));
    form.append("job_id", options.jobId);

    const request = new XMLHttpRequest();
    request.open("POST", api("/api/process"));
    request.responseType = "text";

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onUploadProgress?.(event.loaded / event.total);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(parseError(request.responseText, request.status));
      }
    };

    request.onerror = () =>
      reject(new ApiError("network_error", "Falha de conexão com o servidor."));
    request.ontimeout = () =>
      reject(new ApiError("timeout", "O servidor demorou demais para responder."));
    request.onabort = () => reject(new ApiError("aborted", "Envio cancelado."));

    options.signal?.addEventListener("abort", () => request.abort());
    request.send(form);
  });
}

/**
 * Sincroniza o PDF guardado no servidor com o texto editado.
 *
 * Manda o texto inteiro, e não uma lista de substituições: é o servidor que
 * compara com o que está no arquivo, palavra a palavra, e sabe onde cada uma
 * está desenhada. Assim vale qualquer edição, não só as feitas pela busca.
 *
 * O documento é trocado no mesmo endereço: o `version` que volta serve para
 * forçar o navegador a rebuscar a prévia, que ele já tem em cache.
 */
export async function refineResult(id: string, texto: string): Promise<RefineResult> {
  const response = await fetch(api(`/api/refine/${id}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!response.ok) throw parseError(await response.text(), response.status);
  return response.json();
}

export function downloadUrl(id: string, version = 1): string {
  return api(`/api/download/${id}?v=${version}`);
}

export function previewUrl(id: string, version = 1): string {
  return api(`/api/preview/${id}?v=${version}`);
}

/** Remove o resultado do servidor imediatamente (botão "descartar"). */
export function discardResult(id: string): void {
  void fetch(api(`/api/results/${id}`), { method: "DELETE", keepalive: true }).catch(() => {});
}
