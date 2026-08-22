/**
 * O Next é o único serviço exposto. Cada módulo do dashboard tem o seu backend:
 *
 * * `/api/sticker/*` → serviço de figurinhas (Node: renderização + WhatsApp)
 * * `/api/*`         → backend de documentos (FastAPI: OCR e compressão)
 *
 * A regra das figurinhas vem primeiro porque é mais específica. Assim não há
 * CORS no caminho e o deploy continua sendo apontar o nginx para a porta 3000.
 *
 * Na Vercel (Modo B) os rewrites não existem — o navegador fala direto com o
 * backend via NEXT_PUBLIC_API_URL. Neste caso, BACKEND_URL e STICKER_URL ficam
 * ausentes e nenhum rewrite é registrado.
 */
const BACKEND_URL = process.env.BACKEND_URL || "";
const STICKER_URL = process.env.STICKER_URL || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    /** @type {import('next/dist/lib/load-custom-routes').Rewrite[]} */
    const rules = [];

    if (STICKER_URL) {
      rules.push({ source: "/api/sticker/:path*", destination: `${STICKER_URL}/api/sticker/:path*` });
    }
    if (BACKEND_URL) {
      rules.push({ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` });
    }

    return rules;
  },
};

export default nextConfig;
