import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import { Countdown } from "@/components/Countdown";
import { NavProvider, NavToggle, Sidebar } from "@/components/Navigation";
import { THEME_SCRIPT, ThemeToggle } from "@/components/ThemeToggle";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE.name} — documentos, figurinhas e foto de perfil`,
  description: SITE.tagline,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes do primeiro paint (sem flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <NavProvider>
          {/* A barra do topo e a lateral são `fixed`: não acompanham a
              rolagem. Quem rola é só a coluna de conteúdo, que reserva o
              espaço das duas com o padding em `.app`. */}
          <header className="topbar">
            <div className="topbar__inner">
              <NavToggle />
              <Link href="/" className="logo">
                {SITE.name}
              </Link>
              <span className="topbar__spacer" />
              <Countdown />
              <ThemeToggle />
            </div>
          </header>

          <Sidebar />

          <div className="app">
            <main className="main">{children}</main>

            <footer className="sitefoot">
              <div className="sitefoot__inner">
                <span className="sitefoot__brand">{SITE.name}</span>
                <nav className="sitefoot__links">
                  <Link href="/privacidade">Privacidade</Link>
                  <Link href="/termos">Termos</Link>
                  <a href={`mailto:${SITE.email}`}>Contato</a>
                </nav>
                <span>
                  © {Math.max(year, SITE.since)} {SITE.name}. Todos os direitos reservados.
                </span>
              </div>
            </footer>
          </div>
        </NavProvider>

        {/* Avisos curtos de ações concluídas — cópia, download, descarte.
            As cores vêm dos tokens em `globals.css`, então o toast acompanha
            o tema claro/escuro sem configuração extra. */}
        <Toaster position="top-center" expand={false} closeButton={false} duration={2600} />
      </body>
    </html>
  );
}
