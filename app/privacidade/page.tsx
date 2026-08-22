import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacidade — ${SITE.name}`,
};

/**
 * Descreve o tratamento real dos arquivos. Se o pipeline mudar (passar a gravar
 * em disco, por exemplo), este texto precisa mudar junto.
 */
export default function Privacidade() {
  return (
    <article className="prose">
      <h1>Privacidade</h1>
      <p className="prose__meta">Como tratamos os seus documentos</p>

      <h2>O que acontece com o arquivo enviado</h2>
      <p>
        O documento é processado na memória do servidor e nunca é gravado em disco. Não
        há banco de dados: nada sobre o seu arquivo é registrado, nem o nome, nem o
        conteúdo, nem o texto reconhecido.
      </p>

      <h2>Por quanto tempo o resultado fica disponível</h2>
      <p>
        O documento processado fica na memória por até 30 minutos, acessível apenas por
        um identificador aleatório gerado no momento do processamento. Depois disso ele é
        descartado automaticamente. O botão <strong>Descartar</strong> apaga na hora, e
        reiniciar o servidor apaga tudo.
      </p>

      <h2>Quem consegue acessar</h2>
      <p>
        O identificador do resultado não é listável nem previsível, e as respostas são
        enviadas com <code>Cache-Control: no-store</code> para não ficarem em caches
        intermediários. Ainda assim, quem tiver o link do resultado dentro da janela de
        30 minutos consegue baixá-lo — não compartilhe esse endereço.
      </p>

      <h2>O que não fazemos</h2>
      <ul>
        <li>Não guardamos cópias dos documentos.</li>
        <li>Não usamos o conteúdo para treinar modelos.</li>
        <li>Não enviamos o arquivo para serviços de terceiros: o OCR roda no servidor.</li>
        <li>Não usamos cookies de rastreamento nem analytics.</li>
      </ul>

      <h2>Registros do servidor</h2>
      <p>
        Como em qualquer servidor web, o acesso gera registros técnicos (endereço IP,
        horário e endpoint chamado), usados para operação e para o limite de envios por
        minuto. Esses registros não contêm o conteúdo dos documentos.
      </p>

      <h2>Contato</h2>
      <p>
        Dúvidas sobre o tratamento dos dados: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    </article>
  );
}
