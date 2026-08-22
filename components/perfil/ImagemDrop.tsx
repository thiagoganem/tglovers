"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";

type ImagemDropProps = {
  titulo: string;
  subtitulo: string;
  /** Miniatura do que já foi escolhido (URL de objeto), se houver. */
  thumb: string | null;
  legenda?: string;
  maxBytes: number;
  /** Ícone do estado vazio. */
  icone: React.ReactNode;
  /**
   * Só um campo por página pode responder ao Ctrl+V — o evento de colar é do
   * documento inteiro e dois ouvintes brigariam pela mesma imagem.
   */
  aceitarColar?: boolean;
  onImagem: (arquivo: File) => void;
  onErro: (motivo: string) => void;
};

/** Área de arrastar, clicar ou colar uma imagem. */
export function ImagemDrop({
  titulo,
  subtitulo,
  thumb,
  legenda,
  maxBytes,
  icone,
  aceitarColar = false,
  onImagem,
  onErro,
}: ImagemDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const profundidade = useRef(0);

  const aceitar = useCallback(
    (arquivo: File | undefined | null) => {
      if (!arquivo) return;
      if (!arquivo.type.startsWith("image/")) {
        onErro("Isso não parece uma imagem. Envie JPG, PNG ou WEBP.");
        return;
      }
      if (arquivo.size === 0) {
        onErro("O arquivo está vazio.");
        return;
      }
      if (arquivo.size > maxBytes) {
        onErro(`Imagem de ${formatBytes(arquivo.size)} — o limite é ${formatBytes(maxBytes)}.`);
        return;
      }
      onImagem(arquivo);
    },
    [maxBytes, onErro, onImagem],
  );

  useEffect(() => {
    if (!aceitarColar) return undefined;
    const aoColar = (evento: ClipboardEvent) => {
      const item = Array.from(evento.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) aceitar(item.getAsFile());
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [aceitar, aceitarColar]);

  const abrir = () => inputRef.current?.click();

  return (
    <div
      className={`dropzone dropzone--compact${arrastando ? " dropzone--active" : ""}${
        thumb ? " dropzone--filled" : ""
      }`}
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        profundidade.current += 1;
        setArrastando(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        profundidade.current -= 1;
        if (profundidade.current <= 0) setArrastando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        profundidade.current = 0;
        setArrastando(false);
        aceitar(e.dataTransfer?.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          aceitar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {thumb ? (
        <div className="imagedrop__filled">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="imagedrop__thumb" src={thumb} alt="" />
          <div className="imagedrop__meta">
            <strong>{titulo}</strong>
            {legenda && <span>{legenda}</span>}
            <span className="imagedrop__swap">trocar imagem</span>
          </div>
        </div>
      ) : (
        <>
          <span className="dropzone__icon">{icone}</span>
          <span className="dropzone__title">{titulo}</span>
          <span className="dropzone__subtitle">{subtitulo}</span>
        </>
      )}
    </div>
  );
}
