import type { ReactElement } from "react";
import { FileIcon, KeyboardIcon, ScissorsIcon } from "@/components/icons";

/**
 * Registro das abas do dashboard.
 *
 * Cada módulo é uma rota própria — o estado de um não atrapalha o outro, o
 * link é compartilhável e um F5 não joga o usuário para o começo. Para somar
 * uma funcionalidade nova: crie `app/<slug>/page.tsx` e adicione uma linha
 * aqui. A barra lateral se monta sozinha.
 */
export type DashboardModule = {
  /** Slug da rota, sem barra. */
  id: string;
  href: string;
  /** Rótulo curto, usado na barra lateral. */
  label: string;
  /** Frase de uma linha, usada no cabeçalho da página. */
  description: string;
  /** Glifo da barra lateral. Referência ao componente, não JSX. */
  icon: (props: { size?: number }) => ReactElement;
  /**
   * Fora do ar: some da barra lateral e a rota devolve 404 em produção.
   *
   * O código continua no lugar, compilando junto com o resto — é uma
   * funcionalidade em espera, não um rascunho abandonado. Em desenvolvimento a
   * rota abre normalmente, senão não haveria como terminá-la.
   */
  oculto?: boolean;
};

export const MODULES: DashboardModule[] = [
  {
    id: "documentos",
    href: "/documentos",
    label: "Documentos",
    description: "OCR, edição e compressão de PDFs e imagens.",
    icon: FileIcon,
  },
  {
    id: "figurinhas",
    href: "/figurinhas",
    label: "Figurinhas",
    description: "Imagem em figurinha 512×512 e envio direto no WhatsApp.",
    icon: ScissorsIcon,
    oculto: true,
  },
  {
    id: "teclado",
    href: "/teclado",
    label: "Teclado",
    description: "Símbolos e pontuações difíceis de achar, copiados com um clique.",
    icon: KeyboardIcon,
  },
];

/** O que a barra lateral mostra. */
export const MODULOS_VISIVEIS = MODULES.filter((mod) => !mod.oculto);

/** Um módulo escondido deve responder 404 em produção? */
export function escondidoEmProducao(id: string): boolean {
  return MODULES.some((mod) => mod.id === id && mod.oculto === true);
}

/** Módulo aberto quando alguém entra na raiz. */
export const DEFAULT_MODULE = MODULOS_VISIVEIS[0];
