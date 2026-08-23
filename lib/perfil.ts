/**
 * Montagem da foto de perfil: retrato + selo, recortado para WhatsApp e
 * Instagram.
 *
 * Tudo acontece no navegador, em `<canvas>`. Nenhuma foto sobe para servidor
 * nenhum — o que também significa que este módulo não depende de backend e
 * funciona mesmo com o serviço de documentos fora do ar.
 *
 * As coordenadas são todas **normalizadas** (fração do lado do quadrado), e
 * não pixels: assim a mesma montagem que você vê na prévia de 360px sai
 * idêntica no arquivo de 1080px.
 */

/** Lado do arquivo exportado. 1080 é o tamanho que Instagram e WhatsApp usam. */
export const TAMANHO_EXPORTACAO = 1080;

export type Formato = "redondo" | "quadrado";

/** Uma imagem já decodificada, com as dimensões que o canvas precisa. */
export type Camada = {
  fonte: CanvasImageSource;
  largura: number;
  altura: number;
};

/** Como o retrato está enquadrado dentro do quadrado. */
export type Enquadramento = {
  /** 1 = a foto cobre o quadrado exatamente. Acima disso, aproxima. */
  zoom: number;
  /** Deslocamento do centro, em frações do lado. */
  panX: number;
  panY: number;
};

/** Onde o selo fica sobre a foto. */
export type PosicaoSelo = {
  /** Largura do selo como fração do lado do quadrado. */
  escala: number;
  /** Centro do selo, de 0 a 1. */
  x: number;
  y: number;
};

export type Montagem = {
  foto: Camada | null;
  selo: Camada | null;
  enquadramento: Enquadramento;
  posicaoSelo: PosicaoSelo;
  formato: Formato;
};

export const ENQUADRAMENTO_PADRAO: Enquadramento = { zoom: 1, panX: 0, panY: 0 };

/**
 * Padrão pensado para o pedido: centralizado na horizontal e na parte de
 * baixo, onde numa foto de rosto sobra o busto — abaixo do rosto, portanto.
 * Quem quiser outro lugar arrasta.
 */
export const SELO_PADRAO: PosicaoSelo = { escala: 0.82, x: 0.5, y: 0.78 };

export const LIMITE_ZOOM = { min: 1, max: 6 } as const;
export const LIMITE_ESCALA_SELO = { min: 0.15, max: 2 } as const;

/** Um ponto em pixels do canvas. */
export type Ponto = { x: number; y: number };

/* -------------------------------------------------------------------------
   Carregamento
   ------------------------------------------------------------------------- */

/**
 * Decodifica um arquivo ou URL numa camada pronta para desenhar.
 *
 * `createImageBitmap` com `imageOrientation: "from-image"` respeita o EXIF —
 * sem isso, foto tirada de celular deitada entra girada. Nem todo navegador
 * aceita essa opção, então há a queda para `<img>`, que já aplica a
 * orientação por conta própria.
 */
export async function carregarImagem(origem: File | Blob | string): Promise<Camada> {
  if (typeof origem !== "string" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(origem, { imageOrientation: "from-image" });
      return { fonte: bitmap, largura: bitmap.width, altura: bitmap.height };
    } catch {
      /* formato que o createImageBitmap não abre (HEIC em alguns navegadores):
         tenta pelo <img>, que às vezes dá conta. */
    }
  }

  const url = typeof origem === "string" ? origem : URL.createObjectURL(origem);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível abrir esta imagem."));
      el.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error("A imagem não tem dimensões válidas.");
    }
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight };
  } finally {
    if (typeof origem !== "string") URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------------------
   Geometria
   ------------------------------------------------------------------------- */

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/** Retângulo do retrato dentro do quadrado, em pixels do canvas. */
export function retanguloFoto(foto: Camada, enq: Enquadramento, lado: number) {
  // "Cover": a menor ampliação que ainda tampa o quadrado inteiro.
  const cobertura = Math.max(lado / foto.largura, lado / foto.altura);
  const escala = cobertura * enq.zoom;
  const largura = foto.largura * escala;
  const altura = foto.altura * escala;
  return {
    largura,
    altura,
    x: (lado - largura) / 2 + enq.panX * lado,
    y: (lado - altura) / 2 + enq.panY * lado,
  };
}

/**
 * Impede que o arrasto abra uma faixa vazia na borda. O limite depende do
 * zoom, então precisa ser reaplicado sempre que o zoom muda.
 */
export function limitarEnquadramento(
  enq: Enquadramento,
  foto: Camada | null,
  lado = 1000,
): Enquadramento {
  const zoom = limitar(enq.zoom, LIMITE_ZOOM.min, LIMITE_ZOOM.max);
  if (!foto) return { zoom, panX: 0, panY: 0 };

  const { largura, altura } = retanguloFoto(foto, { ...enq, zoom }, lado);
  const folgaX = Math.max(0, largura - lado) / 2 / lado;
  const folgaY = Math.max(0, altura - lado) / 2 / lado;

  return {
    zoom,
    panX: limitar(enq.panX, -folgaX, folgaX),
    panY: limitar(enq.panY, -folgaY, folgaY),
  };
}

/** Retângulo do selo, em pixels do canvas. Usado no desenho e no arrasto. */
export function retanguloSelo(selo: Camada, pos: PosicaoSelo, lado: number) {
  const largura = lado * pos.escala;
  const altura = (largura * selo.altura) / selo.largura;
  return {
    largura,
    altura,
    x: pos.x * lado - largura / 2,
    y: pos.y * lado - altura / 2,
  };
}

/**
 * Maior largura de selo que ainda cabe dentro do recorte redondo, na altura
 * pedida.
 *
 * O corte para foto de perfil é o círculo inscrito no quadrado, e um selo
 * largo colocado embaixo tem os cantos comidos por ele. Aqui o retângulo do
 * selo é encaixado resolvendo, para a largura `w`, a condição de que o canto
 * mais distante fique sobre a circunferência:
 *
 *     (w/2)² + (dy + w·proporção/2)² = r²
 *
 * — uma equação do segundo grau em `w`, cuja raiz positiva é o limite.
 */
export function encaixarSeloNoCirculo(selo: Camada, y: number, folga = 0.94): number {
  const proporcao = selo.altura / selo.largura;
  const dy = Math.abs(y - 0.5);

  const a = (1 + proporcao * proporcao) / 4;
  const b = dy * proporcao;
  const c = dy * dy - 0.25;

  const delta = b * b - 4 * a * c;
  if (delta <= 0) return LIMITE_ESCALA_SELO.min;

  const largura = ((-b + Math.sqrt(delta)) / (2 * a)) * folga;
  return limitar(largura, LIMITE_ESCALA_SELO.min, LIMITE_ESCALA_SELO.max);
}

/** Posição inicial do selo: centralizado, abaixo do rosto e dentro do círculo. */
export function posicaoInicialSelo(selo: Camada | null): PosicaoSelo {
  if (!selo) return SELO_PADRAO;
  return {
    ...SELO_PADRAO,
    escala: Math.min(SELO_PADRAO.escala, encaixarSeloNoCirculo(selo, SELO_PADRAO.y)),
  };
}

export function limitarPosicaoSelo(pos: PosicaoSelo): PosicaoSelo {
  return {
    escala: limitar(pos.escala, LIMITE_ESCALA_SELO.min, LIMITE_ESCALA_SELO.max),
    // Deixa passar um pouco da borda: às vezes o selo fica melhor "sangrando".
    x: limitar(pos.x, -0.1, 1.1),
    y: limitar(pos.y, -0.1, 1.1),
  };
}

/* -------------------------------------------------------------------------
   Gestos
   -------------------------------------------------------------------------

   Ampliar com dois dedos só parece certo se o que está debaixo deles ficar
   parado. Escalar em torno do centro do quadro, que seria mais simples,
   faz a imagem escorregar embaixo do dedo — e a montagem inteira é feita no
   olho, então essa fuga aparece.

   As duas funções abaixo resolvem a mesma equação para camadas diferentes:
   dado um fator de escala e um ponto que deve permanecer onde está, qual é o
   novo posicionamento.
*/

/**
 * Amplia o retrato mantendo `ancora` no mesmo lugar da tela.
 *
 * O ponto de tela vira coordenada da própria foto (`u`, de 0 a 1), a foto é
 * reescalada, e o deslocamento é recalculado para que aquele `u` volte a cair
 * exatamente sobre a âncora.
 */
export function escalarFoto(
  enq: Enquadramento,
  foto: Camada,
  lado: number,
  fator: number,
  ancora: Ponto,
): Enquadramento {
  const zoom = limitar(enq.zoom * fator, LIMITE_ZOOM.min, LIMITE_ZOOM.max);
  const antes = retanguloFoto(foto, enq, lado);
  const depois = retanguloFoto(foto, { ...enq, zoom }, lado);

  const u = (ancora.x - antes.x) / antes.largura;
  const v = (ancora.y - antes.y) / antes.altura;

  return {
    zoom,
    panX: (ancora.x - u * depois.largura - (lado - depois.largura) / 2) / lado,
    panY: (ancora.y - v * depois.altura - (lado - depois.altura) / 2) / lado,
  };
}

/**
 * Amplia o selo mantendo `ancora` no mesmo lugar da tela.
 *
 * Aqui é mais direto: o selo é posicionado pelo centro, então basta escalar
 * junto o vetor que vai da âncora até esse centro.
 */
export function escalarSelo(
  pos: PosicaoSelo,
  lado: number,
  fator: number,
  ancora: Ponto,
): PosicaoSelo {
  const escala = limitar(
    pos.escala * fator,
    LIMITE_ESCALA_SELO.min,
    LIMITE_ESCALA_SELO.max,
  );
  // O fator efetivo pode ser menor que o pedido, se bateu no limite. Usar o
  // pedido aqui faria o selo escorregar ao insistir no gesto depois do teto.
  const efetivo = escala / pos.escala;

  return {
    escala,
    x: (ancora.x - (ancora.x - pos.x * lado) * efetivo) / lado,
    y: (ancora.y - (ancora.y - pos.y * lado) * efetivo) / lado,
  };
}

/** O ponto está sobre o selo? (coordenadas em pixels do canvas) */
export function pontoNoSelo(
  ponto: { x: number; y: number },
  selo: Camada | null,
  pos: PosicaoSelo,
  lado: number,
): boolean {
  if (!selo) return false;
  const r = retanguloSelo(selo, pos, lado);
  return (
    ponto.x >= r.x && ponto.x <= r.x + r.largura && ponto.y >= r.y && ponto.y <= r.y + r.altura
  );
}

/* -------------------------------------------------------------------------
   Desenho
   ------------------------------------------------------------------------- */

/**
 * Desenha a montagem inteira num quadrado de lado `lado`.
 *
 * É a mesma função da prévia e da exportação — o arquivo salvo não pode
 * surpreender quem acabou de ver a prévia.
 */
export function desenhar(
  ctx: CanvasRenderingContext2D,
  lado: number,
  montagem: Montagem,
): void {
  const { foto, selo, enquadramento, posicaoSelo, formato } = montagem;

  // Fora do recorte não entra cor nenhuma: o PNG sai com o canto transparente,
  // que é o que o WhatsApp e o Instagram esperam de uma foto de perfil.
  ctx.clearRect(0, 0, lado, lado);
  ctx.save();

  if (formato === "redondo") {
    ctx.beginPath();
    ctx.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  if (foto) {
    const r = retanguloFoto(foto, enquadramento, lado);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(foto.fonte, r.x, r.y, r.largura, r.altura);
  }

  if (selo) {
    const r = retanguloSelo(selo, posicaoSelo, lado);
    ctx.drawImage(selo.fonte, r.x, r.y, r.largura, r.altura);
  }

  ctx.restore();
}

/** Renderiza em tamanho cheio e devolve o PNG. */
export async function exportarPng(
  montagem: Montagem,
  lado = TAMANHO_EXPORTACAO,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não conseguiu abrir o editor de imagem.");

  desenhar(ctx, lado, montagem);

  // PNG sempre: JPEG não guarda a transparência do recorte redondo.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não foi possível gerar o arquivo.");
  return blob;
}

/** Nome de arquivo previsível, sem depender do nome que veio do celular. */
export function nomeArquivo(formato: Formato): string {
  const dia = new Date().toISOString().slice(0, 10);
  return `perfil-${formato}-${dia}.png`;
}

/* -------------------------------------------------------------------------
   Saída
   ------------------------------------------------------------------------- */

/** Como a montagem saiu do aparelho. */
export type Destino = "compartilhado" | "baixado" | "cancelado";

/** Texto que acompanha a imagem na folha de compartilhamento. */
const LEGENDA = "Eu apoio!";

/**
 * Entrega a montagem pronta: pela folha de compartilhamento do sistema, ou,
 * onde ela não existir, como download.
 *
 * A folha do sistema é o caminho curto para o WhatsApp — ela lista os
 * aplicativos instalados e a imagem vai direto para a conversa, sem passar
 * pela galeria. É o gesto que faz sentido no celular, que é de onde quase todo
 * mundo vai apoiar.
 *
 * Só que compartilhar **arquivo** não existe em todo lugar: no Firefox e no
 * Chrome de desktop no macOS e no Linux, `canShare` recusa arquivos. Por isso o
 * download continua aqui como queda — sem ele o botão simplesmente não faria
 * nada nessas combinações.
 */
export async function entregar(montagem: Montagem, formato: Formato): Promise<Destino> {
  const blob = await exportarPng(montagem);
  const nome = nomeArquivo(formato);
  const arquivo = new File([blob], nome, { type: "image/png" });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], text: LEGENDA });
      return "compartilhado";
    } catch (erro) {
      // Fechar a folha sem escolher ninguém não é falha — é uma decisão.
      if (erro instanceof DOMException && erro.name === "AbortError") return "cancelado";
      // Qualquer outro tropeço da folha: ainda dá para entregar o arquivo.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  // Espera o navegador iniciar o download antes de invalidar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "baixado";
}
