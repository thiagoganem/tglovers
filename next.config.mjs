/**
 * O Next é o único serviço exposto. Cada módulo do dashboard tem o seu backend:
 *
 * * `/api/sticker/*` → serviço de figurinhas (Node: renderização + WhatsApp)
 * * `/api/*`         → backend de documentos (FastAPI: OCR e compressão)
 *
 * A regra das figurinhas vem primeiro porque é mais específica. Assim não há
 * CORS no caminho e o deploy continua sendo apontar o nginx para a porta 3000.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
const STICKER_URL = process.env.STICKER_URL ?? "http://127.0.0.1:8100";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/sticker/:path*", destination: `${STICKER_URL}/api/sticker/:path*` },
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
