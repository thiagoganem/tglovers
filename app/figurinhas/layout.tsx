import { notFound } from "next/navigation";
import { escondidoEmProducao } from "@/lib/modules";

/**
 * Trava da rota enquanto o módulo estiver marcado como oculto.
 *
 * Tirar o link da barra lateral esconde a porta, não a tranca: quem souber o
 * endereço entra assim mesmo. Como a decisão é do servidor, o 404 chega antes
 * de qualquer JavaScript — nem o código da tela é baixado.
 *
 * Em desenvolvimento a rota abre normalmente: o módulo está em espera, não
 * abandonado, e precisa continuar testável.
 */
export default function FigurinhasLayout({ children }: { children: React.ReactNode }) {
  if (escondidoEmProducao("figurinhas") && process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
