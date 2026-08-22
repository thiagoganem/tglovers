"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { MODULOS_VISIVEIS } from "@/lib/modules";

/**
 * Navegação lateral do dashboard.
 *
 * O botão que abre a gaveta mora na barra do topo e a gaveta em si mora ao
 * lado do conteúdo — dois pontos distantes da árvore. Um contexto pequeno
 * liga os dois sem obrigar o layout (que é servidor) a virar cliente.
 *
 * Em telas largas a barra é fixa e o contexto fica ocioso; abaixo de 900px
 * ela vira gaveta sobre o conteúdo.
 */

type NavState = { aberta: boolean; abrir: () => void; fechar: () => void };

const NavContext = createContext<NavState | null>(null);

function useNav(): NavState {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("Componente de navegação usado fora do NavProvider.");
  return ctx;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();

  const fechar = useCallback(() => setAberta(false), []);
  const abrir = useCallback(() => setAberta(true), []);

  // Trocou de página: a gaveta já cumpriu o papel dela.
  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  // Com a gaveta aberta o fundo não rola — senão o dedo arrasta a página
  // atrás do menu. E Esc fecha, como em qualquer sobreposição.
  useEffect(() => {
    if (!aberta) return undefined;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta]);

  const valor = useMemo(() => ({ aberta, abrir, fechar }), [aberta, abrir, fechar]);

  return <NavContext.Provider value={valor}>{children}</NavContext.Provider>;
}

/**
 * Esconde a barra lateral enquanto o componente que chama estiver ativo.
 *
 * Serve para telas que pedem largura e concentração — o editor de texto é o
 * caso. A marca vai no elemento raiz, e não no contexto, porque quem reserva o
 * espaço da barra é o CSS de `.app`, montado no layout (que é servidor).
 */
export function useModoFoco(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return undefined;
    document.documentElement.dataset.foco = "1";
    return () => {
      delete document.documentElement.dataset.foco;
    };
  }, [ativo]);
}


/** Botão da barra do topo. O CSS o esconde quando a barra lateral é fixa. */
export function NavToggle() {
  const { aberta, abrir, fechar } = useNav();

  return (
    <button
      type="button"
      className="icon-button navtoggle"
      onClick={aberta ? fechar : abrir}
      aria-expanded={aberta}
      aria-controls="navegacao-lateral"
      aria-label={aberta ? "Fechar o menu" : "Abrir o menu"}
      title={aberta ? "Fechar o menu" : "Abrir o menu"}
    >
      {aberta ? <CloseIcon /> : <MenuIcon />}
    </button>
  );
}

export function Sidebar() {
  const { aberta, fechar } = useNav();
  const pathname = usePathname();

  return (
    <>
      {/* Só existe quando a gaveta está aberta: em tela larga não há o que
          cobrir. `aria-hidden` porque fechar já está no botão e no Esc. */}
      {aberta && <div className="sidebar__backdrop" onClick={fechar} aria-hidden="true" />}

      <aside
        id="navegacao-lateral"
        className={`sidebar${aberta ? " sidebar--aberta" : ""}`}
        aria-label="Módulos"
      >
        <nav className="sidebar__nav">
          {MODULOS_VISIVEIS.map((mod) => {
            const ativo = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
            const Icone = mod.icon;
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className={`navlink${ativo ? " navlink--ativo" : ""}`}
                aria-current={ativo ? "page" : undefined}
              >
                <span className="navlink__icon">
                  <Icone size={18} />
                </span>
                <span className="navlink__text">
                  <strong>{mod.label}</strong>
                  <em>{mod.description}</em>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
