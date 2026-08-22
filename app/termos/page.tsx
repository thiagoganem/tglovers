import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Termos de uso — ${SITE.name}`,
};

export default function Termos() {
  return (
    <article className="prose">
      <h1>Termos de uso</h1>
      <p className="prose__meta">Condições do serviço</p>

      <h2>O serviço</h2>
      <p>
        O {SITE.name} reconhece o texto de documentos por OCR, gera um PDF pesquisável e
        reduz o tamanho do arquivo. O serviço é oferecido no estado em que se encontra,
        sem garantia de disponibilidade contínua.
      </p>

      <h2>Uso adequado</h2>
      <ul>
        <li>Envie apenas documentos que você tem o direito de processar.</li>
        <li>
          Não use o serviço para conteúdo ilegal nem para tentar sobrecarregar o
          servidor. Há limite de envios por minuto e de tamanho por arquivo.
        </li>
        <li>
          O processamento é automatizado e compartilhado: envios em excesso podem ser
          recusados temporariamente.
        </li>
      </ul>

      <h2>Limites técnicos</h2>
      <ul>
        <li>Formatos aceitos: PDF, JPG, JPEG, PNG e TIFF.</li>
        <li>Tamanho máximo de envio e número máximo de páginas definidos pelo servidor.</li>
        <li>
          A meta de 10 MB é uma tentativa, não uma promessa: documentos com muitas
          imagens de alta resolução podem não caber sem perda inaceitável de qualidade.
          Nesse caso avisamos claramente no resultado.
        </li>
      </ul>

      <h2>Precisão do OCR</h2>
      <p>
        O reconhecimento é automático e pode errar, especialmente em originais tortos,
        com baixa nitidez ou manuscritos. Exibimos a confiança média justamente para isso
        ficar evidente. <strong>Revise o texto antes de usá-lo</strong> em qualquer
        contexto que dependa de exatidão — não nos responsabilizamos por decisões tomadas
        a partir do texto reconhecido.
      </p>

      <h2>Responsabilidade</h2>
      <p>
        O serviço não substitui uma cópia de segurança. Mantenha o arquivo original: o
        documento processado é descartado automaticamente e não pode ser recuperado
        depois disso.
      </p>

      <h2>Contato</h2>
      <p>
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>
    </article>
  );
}
