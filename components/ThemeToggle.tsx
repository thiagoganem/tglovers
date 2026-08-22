"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

export const THEME_KEY = "tglovers-theme";

/**
 * Script que roda antes do primeiro paint, evitando o flash de tema errado.
 * É injetado no `<head>` pelo layout.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // O tema real já foi aplicado pelo script acima; aqui só sincronizamos o ícone.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* modo privado: o tema vale só para esta sessão */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      title={theme === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      aria-label={theme === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
