/**
 * Copia para `public/` os recursos que o pdf.js busca por HTTP em tempo de
 * execução: o worker, as fontes padrão (base-14) e os cmaps (codificações CJK).
 *
 * Sem as fontes padrão, renderizar um PDF que use Helvetica sem embutir a
 * fonte — a maioria dos PDFs simples — **fica travado para sempre**, sem erro
 * visível: o pdf.js espera por um recurso que nunca chega. É por isso que este
 * passo roda antes do `dev` e do `build`, e não é opcional.
 *
 * O worker também vem por aqui, e não por `new URL(..., import.meta.url)`: o
 * caminho com hash que o bundler gera nem sempre é servido pelo Next (dá 404 e
 * o pdf.js cai num modo degradado). Um caminho fixo em `public/` não depende do
 * humor do empacotador.
 *
 * Copiar em vez de versionar mantém os arquivos sempre na mesma versão do
 * pacote instalado.
 */
import { copyFile, cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "node_modules", "pdfjs-dist");
const destino = join(raiz, "public");

const RECURSOS = [
  { de: "standard_fonts", para: "pdfjs/standard_fonts" },
  { de: "cmaps", para: "pdfjs/cmaps" },
];

if (!existsSync(origem)) {
  console.error("pdfjs-dist não está instalado — rode `npm install` antes.");
  process.exit(1);
}

for (const recurso of RECURSOS) {
  const entrada = join(origem, recurso.de);
  const saida = join(destino, recurso.para);
  await mkdir(dirname(saida), { recursive: true });
  await cp(entrada, saida, { recursive: true });
  const arquivos = await readdir(saida);
  console.log(`pdf.js: ${arquivos.length} arquivos em public/${recurso.para}`);
}

await copyFile(
  join(origem, "build", "pdf.worker.min.mjs"),
  join(destino, "pdfjs", "pdf.worker.min.mjs"),
);
console.log("pdf.js: worker em public/pdfjs/pdf.worker.min.mjs");
