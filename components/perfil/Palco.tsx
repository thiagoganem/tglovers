"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  desenhar,
  limitarEnquadramento,
  limitarPosicaoSelo,
  pontoNoSelo,
  type Enquadramento,
  type Montagem,
  type PosicaoSelo,
} from "@/lib/perfil";

type PalcoProps = {
  montagem: Montagem;
  onEnquadramento: (enq: Enquadramento) => void;
  onPosicaoSelo: (pos: PosicaoSelo) => void;
};

type Arrasto = {
  ponteiro: number;
  alvo: "foto" | "selo";
  /** Posição do ponteiro no início, em pixels do canvas. */
  origemX: number;
  origemY: number;
  /** Valores no início do arrasto — o delta é sempre medido a partir daqui. */
  inicioX: number;
  inicioY: number;
};

/**
 * Prévia ao vivo, com arrasto direto.
 *
 * Quem manda no arrasto é onde o dedo caiu: em cima do selo, move o selo;
 * em qualquer outro lugar, reenquadra a foto. Sai mais barato do que um
 * seletor de camada e funciona igual no toque e no mouse.
 */
export function Palco({ montagem, onEnquadramento, onPosicaoSelo }: PalcoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<Arrasto | null>(null);
  const [lado, setLado] = useState(0);
  const [pegando, setPegando] = useState(false);

  // O canvas precisa de pixels; o layout dá porcentagem. O observador
  // reconcilia os dois a cada mudança de largura (inclusive ao abrir a
  // gaveta lateral, que estreita o conteúdo).
  useEffect(() => {
    const alvo = containerRef.current;
    if (!alvo) return undefined;

    const medir = () => setLado(Math.round(alvo.getBoundingClientRect().width));
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || lado <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(lado * dpr);
    canvas.height = Math.round(lado * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenhar(ctx, lado, montagem);
  }, [lado, montagem]);

  const pontoLocal = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const aoPressionar = (e: React.PointerEvent) => {
    if (!montagem.foto && !montagem.selo) return;

    const ponto = pontoLocal(e);
    const noSelo = pontoNoSelo(ponto, montagem.selo, montagem.posicaoSelo, lado);
    if (!noSelo && !montagem.foto) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = noSelo
      ? {
          ponteiro: e.pointerId,
          alvo: "selo",
          origemX: ponto.x,
          origemY: ponto.y,
          inicioX: montagem.posicaoSelo.x,
          inicioY: montagem.posicaoSelo.y,
        }
      : {
          ponteiro: e.pointerId,
          alvo: "foto",
          origemX: ponto.x,
          origemY: ponto.y,
          inicioX: montagem.enquadramento.panX,
          inicioY: montagem.enquadramento.panY,
        };
    setPegando(true);
  };

  const aoMover = (e: React.PointerEvent) => {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== e.pointerId || lado <= 0) return;

    const ponto = pontoLocal(e);
    const dx = (ponto.x - atual.origemX) / lado;
    const dy = (ponto.y - atual.origemY) / lado;

    if (atual.alvo === "selo") {
      onPosicaoSelo(
        limitarPosicaoSelo({
          ...montagem.posicaoSelo,
          x: atual.inicioX + dx,
          y: atual.inicioY + dy,
        }),
      );
    } else {
      onEnquadramento(
        limitarEnquadramento(
          { ...montagem.enquadramento, panX: atual.inicioX + dx, panY: atual.inicioY + dy },
          montagem.foto,
        ),
      );
    }
  };

  const aoSoltar = (e: React.PointerEvent) => {
    if (arrasto.current?.ponteiro !== e.pointerId) return;
    arrasto.current = null;
    setPegando(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const vazio = !montagem.foto && !montagem.selo;

  return (
    <div
      ref={containerRef}
      className={`palco checker${pegando ? " palco--pegando" : ""}`}
      // `touch-action: none` no CSS: sem isso o navegador rola a página em
      // vez de deixar o dedo arrastar a foto.
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
    >
      <canvas
        ref={canvasRef}
        className="palco__canvas"
        style={{ width: lado, height: lado }}
        role="img"
        aria-label="Prévia da foto de perfil"
      />

      {vazio && <p className="palco__vazio">Envie uma foto para começar</p>}

      {/* Guia do recorte: o WhatsApp e o Instagram cortam em círculo, e ver
          isso antes de baixar evita o susto do rosto cortado. */}
      {montagem.formato === "quadrado" && !vazio && (
        <div className="palco__guia" aria-hidden="true" />
      )}
    </div>
  );
}
