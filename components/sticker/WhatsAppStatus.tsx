"use client";

import { useEffect, useRef } from "react";
import type { EstadoWa } from "@/lib/sticker";

type WhatsAppStatusProps = {
  wa: EstadoWa | null;
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
};

function rotulo(wa: EstadoWa | null): { texto: string; tom: string } {
  if (!wa) return { texto: "verificando serviço…", tom: "aguardando" };
  if (wa.conectado) return { texto: wa.usuario?.nome || "WhatsApp conectado", tom: "ok" };
  if (wa.conectando) return { texto: wa.qr ? "escaneie o QR" : wa.motivo || "conectando…", tom: "aguardando" };
  return { texto: wa.motivo || "desconectado", tom: "erro" };
}

/**
 * Estado da conexão com o WhatsApp, com o QR na própria tela — quem usa o
 * dashboard não precisa ter acesso ao terminal do servidor para parear.
 */
export function WhatsAppStatus({ wa, aberto, onAbrir, onFechar }: WhatsAppStatusProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { texto, tom } = rotulo(wa);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  // Conectou com o modal aberto: fecha sozinho, o QR já não serve para nada.
  useEffect(() => {
    if (wa?.conectado && aberto) onFechar();
  }, [aberto, onFechar, wa?.conectado]);

  return (
    <>
      <button type="button" className="wastatus" onClick={onAbrir}>
        <span className={`wastatus__dot wastatus__dot--${tom}`} />
        {texto}
      </button>

      <dialog ref={dialogRef} className="modal" onClose={onFechar}>
        <h2>Conectar o WhatsApp</h2>

        {wa?.conectado ? (
          <p>Conectado como {wa.usuario?.nome || wa.usuario?.id}. Tudo pronto para enviar.</p>
        ) : wa?.precisaRelogar ? (
          <p>
            A sessão foi encerrada no celular. Rode <code>npm run logout</code> na pasta
            <code> sticker/</code> e conecte de novo.
          </p>
        ) : (
          <p>
            Abra o WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar aparelho</b> e aponte
            para o código.
          </p>
        )}

        {wa?.qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="modal__qr" src={wa.qr} alt="QR code para conectar o WhatsApp" />
        )}

        {wa?.codigoPareamento && <div className="modal__code">{wa.codigoPareamento}</div>}

        {!wa && (
          <p className="modal__hint">
            O serviço de figurinhas não respondeu. Confira se ele está no ar na porta 8100.
          </p>
        )}

        <button type="button" className="button button--outline button--small" onClick={onFechar}>
          Fechar
        </button>
      </dialog>
    </>
  );
}
