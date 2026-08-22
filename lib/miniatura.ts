/**
 * Miniaturas dos arquivos escolhidos, geradas no navegador.
 *
 * A ideia é simples: antes de mandar qualquer coisa para o servidor, você
 * enxerga o que está mandando — e, com vários arquivos, em que ordem eles vão
 * entrar no documento final.
 *
 * Imagem é direto. PDF exige um renderizador, e o `pdf.js` é carregado sob
 * demanda (`import()`) só quando aparece o primeiro PDF: quem só manda fotos
 * nunca paga por esse pedaço. Se o carregamento falhar, a miniatura vira
 * `null` e a interface mostra um ícone — nada quebra por causa de uma prévia.
 */

/** Onde `scripts/copiar-recursos-pdfjs.mjs` deixa os arquivos do pdf.js. */
const RECURSOS = "/pdfjs/";

/** Lado maior da miniatura, em pixels. Suficiente para um cartão de ~120px. */
const LADO_MAXIMO = 320;

export type Miniatura = {
  /** URL de objeto pronta para um `<img>`. `null` quando não foi possível gerar. */
  url: string | null;
  /** Páginas do PDF, quando dá para saber. */
  paginas: number | null;
};

/** Instância única do pdf.js: carregar duas vezes acorda dois workers. */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function carregarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // Caminho fixo, servido de `public/` por
      // `scripts/copiar-recursos-pdfjs.mjs`. Deixar o bundler resolver isso
      // com `new URL(..., import.meta.url)` gera um caminho com hash que o
      // Next nem sempre serve — e, quando dá 404, o pdf.js cai num modo
      // degradado sem avisar direito.
      pdfjs.GlobalWorkerOptions.workerSrc = `${RECURSOS}pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function paraBlobUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
      "image/jpeg",
      0.75,
    );
  });
}

async function miniaturaDeImagem(arquivo: File): Promise<Miniatura> {
  // Reduzir antes de exibir evita segurar um JPEG de 12 MP na memória só para
  // desenhar um quadradinho de 120px — e a lista pode ter vinte deles.
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));

    const ctx = canvas.getContext("2d");
    if (!ctx) return { url: null, paginas: 1 };
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return { url: await paraBlobUrl(canvas), paginas: 1 };
  } finally {
    bitmap.close();
  }
}

async function miniaturaDePdf(arquivo: File): Promise<Miniatura> {
  const pdfjs = await carregarPdfjs();
  const documento = await pdfjs.getDocument({
    data: await arquivo.arrayBuffer(),
    // Um PDF enviado por terceiros não tem por que executar nada: a prévia só
    // precisa dos pixels da primeira página.
    isEvalSupported: false,
    disableAutoFetch: true,
    // Desenha os glifos como vetor em vez de registrar `@font-face`. Duas
    // razões, e as duas importam: o navegador adia o carregamento de fontes em
    // aba oculta — e o pdf.js espera por ele, então a miniatura ficaria
    // pendurada para sempre; e nenhuma fonte de um arquivo de terceiros entra
    // no documento. Em 320px a diferença de desenho não aparece.
    disableFontFace: true,
    useSystemFonts: false,
    // Recursos que o pdf.js busca por HTTP. Sem eles a renderização de um PDF
    // com fonte não embutida — o caso comum — fica pendurada sem erro nenhum.
    // `scripts/copiar-recursos-pdfjs.mjs` põe os arquivos aqui antes do build.
    standardFontDataUrl: `${RECURSOS}standard_fonts/`,
    cMapUrl: `${RECURSOS}cmaps/`,
    cMapPacked: true,
  }).promise;

  try {
    const pagina = await documento.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(1.5, LADO_MAXIMO / Math.max(base.width, base.height));
    const viewport = pagina.getViewport({ scale: escala });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const ctx = canvas.getContext("2d");
    if (!ctx) return { url: null, paginas: documento.numPages };

    // Papel branco por baixo: um PDF sem fundo desenhado sairia transparente,
    // e no tema escuro isso vira um retângulo preto sem sentido.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tarefa = pagina.render({ canvasContext: ctx, viewport });
    // Por padrão o pdf.js agenda cada fatia do desenho em
    // `requestAnimationFrame` — que o navegador não dispara em aba oculta. Uma
    // miniatura gerada em segundo plano ficaria pendurada para sempre. Assumir
    // o `onContinue` tira o rAF do caminho: seguimos na hora, sempre.
    tarefa.onContinue = (continuar: () => void) => continuar();
    await tarefa.promise;

    return { url: await paraBlobUrl(canvas), paginas: documento.numPages };
  } finally {
    await documento.destroy();
  }
}

const VAZIA: Miniatura = { url: null, paginas: null };

/** Tempo máximo por arquivo. Um caso patológico não pode travar a fila. */
const LIMITE_MS = 15_000;

function comPrazo<T>(promessa: Promise<T>, alternativa: T): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((resolve) => setTimeout(() => resolve(alternativa), LIMITE_MS)),
  ]);
}

/**
 * Gera a miniatura de um arquivo. Nunca lança e nunca fica pendurada: erro ou
 * demora viram uma miniatura vazia, e a lista continua utilizável.
 */
export async function gerarMiniatura(arquivo: File): Promise<Miniatura> {
  try {
    if (arquivo.type.startsWith("image/")) {
      return await comPrazo(miniaturaDeImagem(arquivo), VAZIA);
    }
    if (/\.pdf$/i.test(arquivo.name) || arquivo.type === "application/pdf") {
      return await comPrazo(miniaturaDePdf(arquivo), VAZIA);
    }
  } catch {
    /* prévia é conforto, não requisito */
  }
  return VAZIA;
}
