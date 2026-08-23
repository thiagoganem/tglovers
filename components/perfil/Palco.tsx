"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  desenhar,
  escalarFoto,
  escalarSelo,
  limitarEnquadramento,
  limitarPosicaoSelo,
  pontoNoSelo,
  type Enquadramento,
  type Montagem,
  type Ponto,
  type PosicaoSelo,
} from "@/lib/perfil";

type PalcoProps = {
  montagem: Montagem;
  onEnquadramento: (enq: Enquadramento) => void;
  onPosicaoSelo: (pos: PosicaoSelo) => void;
};

/** Qual camada os dedos estão manipulando. */
type Alvo = "foto" | "selo";

/**
 * O estado da camada quando o gesto começou.
 *
 * Todo movimento é medido a partir daqui, e não do quadro anterior. Acumular
 * quadro a quadro faz o erro de arredondamento somar: a imagem vai derivando
 * sozinha durante um gesto longo.
 */
type Inicio = {
  alvo: Alvo;
  enquadramento: Enquadramento;
  posicaoSelo: PosicaoSelo;
  /** Centro entre os dedos no início — com um dedo só, o próprio ponto. */
  centro: Ponto;
  /** Distância entre os dedos no início. Zero enquanto houver um dedo só. */
  distancia: number;
};

function centroDe(pontos: Ponto[]): Ponto {
  const soma = pontos.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: soma.x / pontos.length, y: soma.y / pontos.length };
}

function distanciaDe(pontos: Ponto[]): number {
  if (pontos.length < 2) return 0;
  return Math.hypot(pontos[0].x - pontos[1].x, pontos[0].y - pontos[1].y);
}

/**
 * Prévia ao vivo, manipulada direto com os dedos.
 *
 * Um dedo move, dois dedos redimensionam — como em qualquer app de foto, e sem
 * controle nenhum na tela. Quem manda no alvo é onde o gesto começou: em cima
 * do selo, mexe no selo; em qualquer outro lugar, na foto. Sai mais barato do
 * que um seletor de camada e funciona igual no toque e no mouse.
 *
 * No mouse, a roda faz o papel dos dois dedos.
 */
export function Palco({ montagem, onEnquadramento, onPosicaoSelo }: PalcoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Dedos (ou botões) encostados agora, na ordem em que chegaram. */
  const ponteiros = useRef<Map<number, Ponto>>(new Map());
  const inicio = useRef<Inicio | null>(null);

  const [lado, setLado] = useState(0);
  const [pegando, setPegando] = useState(false);

  // O canvas precisa de pixels; o layout dá porcentagem. O observador
  // reconcilia os dois a cada mudança de largura.
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

  const pontoLocal = useCallback((e: React.PointerEvent): Ponto => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  /** Congela o estado atual como referência do gesto que está começando. */
  const ancorar = useCallback(
    (alvo: Alvo) => {
      const pontos = [...ponteiros.current.values()];
      inicio.current = {
        alvo,
        enquadramento: montagem.enquadramento,
        posicaoSelo: montagem.posicaoSelo,
        centro: centroDe(pontos),
        distancia: distanciaDe(pontos),
      };
    },
    [montagem.enquadramento, montagem.posicaoSelo],
  );

  const aoPressionar = (e: React.PointerEvent) => {
    if (!montagem.foto && !montagem.selo) return;

    const ponto = pontoLocal(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, ponto);

    // O alvo é decidido no primeiro dedo e não muda no meio do gesto: o
    // segundo dedo quase sempre cai fora do selo, e trocar de camada ali
    // faria a pinça mexer no que não foi tocado.
    const alvo: Alvo =
      inicio.current?.alvo ??
      (pontoNoSelo(ponto, montagem.selo, montagem.posicaoSelo, lado) ? "selo" : "foto");

    if (alvo === "foto" && !montagem.foto) return;

    ancorar(alvo);
    setPegando(true);
  };

  const aoMover = (e: React.PointerEvent) => {
    const base = inicio.current;
    if (!base || !ponteiros.current.has(e.pointerId) || lado <= 0) return;

    ponteiros.current.set(e.pointerId, pontoLocal(e));
    const pontos = [...ponteiros.current.values()];
    const centro = centroDe(pontos);
    const distancia = distanciaDe(pontos);

    const fator = base.distancia > 0 && distancia > 0 ? distancia / base.distancia : 1;
    const dx = (centro.x - base.centro.x) / lado;
    const dy = (centro.y - base.centro.y) / lado;

    if (base.alvo === "selo") {
      // Escala primeiro, ancorada onde o gesto começou; o arrasto entra depois,
      // por cima. Invertida, a ordem faria a escala puxar o deslocamento junto.
      const escalado = escalarSelo(base.posicaoSelo, lado, fator, base.centro);
      onPosicaoSelo(limitarPosicaoSelo({ ...escalado, x: escalado.x + dx, y: escalado.y + dy }));
      return;
    }

    if (!montagem.foto) return;
    const escalado = escalarFoto(base.enquadramento, montagem.foto, lado, fator, base.centro);
    onEnquadramento(
      limitarEnquadramento(
        { ...escalado, panX: escalado.panX + dx, panY: escalado.panY + dy },
        montagem.foto,
        lado,
      ),
    );
  };

  const aoSoltar = (e: React.PointerEvent) => {
    ponteiros.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (ponteiros.current.size === 0) {
      inicio.current = null;
      setPegando(false);
      return;
    }
    // Levantou um dedo e ainda há outro na tela: o gesto continua, mas as
    // referências viraram. Sem reancorar, a imagem salta.
    if (inicio.current) ancorar(inicio.current.alvo);
  };

  /**
   * Roda do mouse: o equivalente da pinça para quem não tem tela sensível.
   *
   * Não dá para usar `onWheel` do React — ele registra o ouvinte como passivo,
   * e um ouvinte passivo não pode impedir a página de rolar junto.
   */
  useEffect(() => {
    const alvo = containerRef.current;
    if (!alvo || lado <= 0) return undefined;

    const aoRolar = (e: WheelEvent) => {
      if (!montagem.foto && !montagem.selo) return;
      e.preventDefault();

      const rect = alvo.getBoundingClientRect();
      const ancora = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const fator = Math.exp(-e.deltaY * 0.002);

      if (pontoNoSelo(ancora, montagem.selo, montagem.posicaoSelo, lado)) {
        onPosicaoSelo(limitarPosicaoSelo(escalarSelo(montagem.posicaoSelo, lado, fator, ancora)));
      } else if (montagem.foto) {
        onEnquadramento(
          limitarEnquadramento(
            escalarFoto(montagem.enquadramento, montagem.foto, lado, fator, ancora),
            montagem.foto,
            lado,
          ),
        );
      }
    };

    alvo.addEventListener("wheel", aoRolar, { passive: false });
    return () => alvo.removeEventListener("wheel", aoRolar);
  }, [lado, montagem, onEnquadramento, onPosicaoSelo]);

  const vazio = !montagem.foto && !montagem.selo;

  return (
    <div
      ref={containerRef}
      className={`palco checker${pegando ? " palco--pegando" : ""}`}
      // `touch-action: none` no CSS: sem isso o navegador rola e amplia a
      // página em vez de deixar os dedos manipularem a montagem.
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
