"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatIcon, GroupIcon } from "@/components/icons";
import { fetchConversas, resolverNumero, StickerError, type Conversa } from "@/lib/sticker";

type DestinationPickerProps = {
  destino: Conversa | null;
  conectado: boolean;
  onDestino: (conversa: Conversa) => void;
  onErro: (mensagem: string) => void;
};

/**
 * Escolha do destino: grupos e contatos que o serviço já conhece, com busca.
 * Quem não aparece na lista pode ser alcançado pelo número — que é conferido
 * no WhatsApp antes de virar destino, então não dá para enviar para o vazio.
 */
export function DestinationPicker({
  destino,
  conectado,
  onDestino,
  onErro,
}: DestinationPickerProps) {
  const [busca, setBusca] = useState("");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [numero, setNumero] = useState("");
  const [buscandoNumero, setBuscandoNumero] = useState(false);
  const primeiraCarga = useRef(true);

  const carregar = useCallback(
    async (termo: string, signal?: AbortSignal) => {
      try {
        setConversas(await fetchConversas(termo, signal));
      } catch {
        /* lista vazia já comunica o problema; o status do topo explica */
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const atraso = primeiraCarga.current ? 0 : 250;
    primeiraCarga.current = false;
    const timer = setTimeout(() => carregar(busca, controller.signal), atraso);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busca, carregar]);

  // Conversas aparecem conforme o WhatsApp sincroniza: vale reconsultar.
  useEffect(() => {
    if (!conectado) return undefined;
    const timer = setInterval(() => carregar(busca), 30_000);
    return () => clearInterval(timer);
  }, [busca, carregar, conectado]);

  const buscarNumero = async () => {
    if (!numero.trim()) return;
    setBuscandoNumero(true);
    try {
      const conversa = await resolverNumero(numero);
      onDestino(conversa);
      setNumero("");
      await carregar(busca);
    } catch (err) {
      onErro(err instanceof StickerError ? err.message : "não consegui verificar esse número");
    } finally {
      setBuscandoNumero(false);
    }
  };

  return (
    <>
      <input
        type="search"
        className="input input--block"
        placeholder="Buscar grupo ou contato…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <ul className="chats" role="listbox" aria-label="Conversas">
        {conversas.map((conversa) => {
          const ativa = destino?.id === conversa.id;
          return (
            <li key={conversa.id}>
              <button
                type="button"
                role="option"
                aria-selected={ativa}
                className={`chat${ativa ? " chat--active" : ""}`}
                onClick={() => onDestino(conversa)}
              >
                <span className="chat__avatar">
                  {conversa.tipo === "grupo" ? <GroupIcon size={16} /> : <ChatIcon size={16} />}
                </span>
                <span className="chat__name">{conversa.nome}</span>
                <span className="chat__kind">{conversa.tipo}</span>
              </button>
            </li>
          );
        })}

        {conversas.length === 0 && (
          <li className="chats__empty">
            {carregando
              ? "Carregando conversas…"
              : busca
                ? "Nada encontrado com esse termo."
                : "Nenhuma conversa ainda. Mande ou receba uma mensagem no WhatsApp, ou use o número abaixo."}
          </li>
        )}
      </ul>

      <div className="row">
        <input
          type="tel"
          className="input"
          placeholder="55 11 99999-9999"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") buscarNumero();
          }}
        />
        <button
          type="button"
          className="button button--outline button--small"
          disabled={!numero.trim() || buscandoNumero || !conectado}
          onClick={buscarNumero}
        >
          {buscandoNumero ? "Verificando…" : "Usar número"}
        </button>
      </div>
    </>
  );
}
