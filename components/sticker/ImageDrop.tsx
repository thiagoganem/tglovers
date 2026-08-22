"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon } from "@/components/icons";
import { formatBytes } from "@/lib/format";

type ImageDropProps = {
  /** Miniatura da imagem já escolhida (URL de objeto), se houver. */
  thumb: string | null;
  dimensoes: { largura: number; altura: number } | null;
  origem: "arquivo" | "ia";
  maxBytes: number;
  disabled?: boolean;
  onImagem: (arquivo: File) => void;
  onRecusa: (motivo: string) => void;
};

/**
 * Área de arrastar, clicar ou colar a imagem.
 *
 * A validação daqui é de conveniência — a real acontece no serviço, que abre
 * o arquivo de verdade antes de aceitar.
 */
export function ImageDrop({
  thumb,
  dimensoes,
  origem,
  maxBytes,
  disabled = false,
  onImagem,
  onRecusa,
}: ImageDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const aceitar = useCallback(
    (arquivo: File | undefined | null) => {
      if (!arquivo) return;
      if (!arquivo.type.startsWith("image/")) {
        onRecusa("Isso não parece uma imagem. Envie JPG, PNG, WEBP, HEIC ou GIF.");
        return;
      }
      if (arquivo.size > maxBytes) {
        onRecusa(`Imagem de ${formatBytes(arquivo.size)} — o limite é ${formatBytes(maxBytes)}.`);
        return;
      }
      if (arquivo.size === 0) {
        onRecusa("O arquivo está vazio.");
        return;
      }
      onImagem(arquivo);
    },
    [maxBytes, onImagem, onRecusa],
  );

  // Colar do teclado é o caminho mais rápido para print de tela.
  useEffect(() => {
    if (disabled) return undefined;
    const aoColar = (evento: ClipboardEvent) => {
      const item = Array.from(evento.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) aceitar(item.getAsFile());
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [aceitar, disabled]);

  const abrir = () => !disabled && inputRef.current?.click();

  return (
    <div
      className={`dropzone dropzone--compact${dragging ? " dropzone--active" : ""}${
        thumb ? " dropzone--filled" : ""
      }`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
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

      {thumb && dimensoes ? (
        <div className="imagedrop__filled">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="imagedrop__thumb" src={thumb} alt="" />
          <div className="imagedrop__meta">
            <strong>
              {dimensoes.largura} × {dimensoes.altura}px
            </strong>
            <span>{origem === "ia" ? "criada com IA" : "arquivo enviado"}</span>
            <span className="imagedrop__swap">trocar imagem</span>
          </div>
        </div>
      ) : (
        <>
          <span className="dropzone__icon">
            <ImageIcon size={24} />
          </span>
          <span className="dropzone__title">Arraste a imagem aqui</span>
          <span className="dropzone__subtitle">
            ou clique para escolher · <kbd>Ctrl</kbd>+<kbd>V</kbd> para colar
          </span>
        </>
      )}
    </div>
  );
}
