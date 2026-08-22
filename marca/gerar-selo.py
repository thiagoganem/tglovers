#!/usr/bin/env python3
"""
Gera `public/selo.png` — a arte da campanha com transparência de verdade.

A arte chegou como JPEG **com o xadrez desenhado nos pixels**: o quadriculado
cinza que os editores mostram no lugar do vazio virou parte da imagem quando
alguém exportou em JPEG, que não tem canal alfa. Colada por cima de uma foto,
essa arte apareceria dentro de um retângulo quadriculado — a "marca d'água" que
não deveria existir.

Aqui o xadrez vira transparência. Dois critérios apagam um pixel:

1. **A cor é do xadrez.** Os dois cinzas ocupam uma faixa estreita de
   luminosidade e não têm cor nenhuma. A arte inteira está fora dessa faixa: o
   contorno é preto, as letras são brancas, o número é laranja e as fitas são
   coloridas.
2. **Ele faz parte de uma mancha larga de xadrez.** Sozinho, o critério de cor
   também comeria o cinza que aparece dentro do desenho — a transição de uma
   letra branca para o contorno preto passa por cinzas. Essas transições são
   fios de um ou dois pixels; o xadrez vem em manchas. Uma erosão separa os
   dois casos, e o alagamento a partir daí recupera as bordas de cada mancha.

O alagamento também parte das quatro laterais, mas as laterais não bastam: a
arte tem um bolsão de xadrez preso entre a tarja de cima e o bloco do número,
sem ligação com o lado de fora. Ele ficaria como um retalho quadriculado no
meio do selo.

Roda à mão, quando a arte mudar:

    python3 marca/gerar-selo.py

O PNG gerado é versionado junto com o código. Gerar no build custaria Python e
Pillow dentro da imagem Docker do frontend por causa de um arquivo que muda uma
vez por campanha.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parent
ORIGEM = RAIZ / "selo-original.jpeg"
DESTINO = RAIZ.parent / "public" / "selo.png"

# Faixa de luminosidade do xadrez. Medida na arte original, onde o fundo vive
# entre 187 e 237; a folga cobre o borrão que o JPEG deixou nas bordas das
# células sem chegar perto do branco (255) das letras.
FUNDO_MIN, FUNDO_MAX = 175.0, 248.0

# Cinza não tem cor: os três canais andam juntos. Qualquer pixel com os canais
# mais separados que isto é arte, mesmo que a luminosidade caia na faixa.
CROMA_MAXIMA = 25.0

# Espessura mínima de uma mancha de xadrez, em pixels. Acima do serrilhado que
# o JPEG deixa nas letras (1 a 2 px) e bem abaixo da célula do xadrez (30 px).
ESPESSURA_MINIMA = 7

# Quanto o fundo avança sobre a arte antes de virar transparência, em pixels.
# O JPEG deixou um fio de mistura entre o cinza e a cor de cada borda: sem
# comer esse fio, a fita colorida de baixo sai com um halo claro em volta,
# visível assim que o selo cai sobre uma foto escura. Um pixel resolve, e o
# contorno preto do selo é grosso demais para sentir falta dele.
ENCOLHER = 3

# Suavização da borda. O contorno da arte é preto sobre cinza claro, então um
# pixel de transição já basta para não sair serrilhado.
FEATHER = 0.8

# Margem transparente mantida em volta da arte, em pixels do original.
MARGEM = 2

# Cores da paleta do PNG final. A arte é chapada — preto, branco, laranja e as
# cinco fitas —, então o que sobra de cor no arquivo é o chiado que o JPEG
# deixou nas áreas lisas. Reduzir a paleta joga esse chiado fora e derruba o
# arquivo de ~385 kB para ~20 kB, sem diferença visível.
CORES = 64


def manchas_largas(candidato: np.ndarray) -> np.ndarray:
    """
    Erosão: sobra só o miolo do que é largo o bastante para ser xadrez.

    `MinFilter` põe em cada pixel o menor valor da vizinhança — num mapa de 0 e
    255, isso apaga tudo que estiver a menos de meia janela de uma borda. Fios
    de serrilhado somem inteiros; manchas de xadrez perdem a casca e mantêm o
    centro, que é o que serve de semente.
    """
    mapa = Image.fromarray(np.where(candidato, 255, 0).astype(np.uint8), mode="L")
    erodido = mapa.filter(ImageFilter.MinFilter(ESPESSURA_MINIMA))
    return np.asarray(erodido) > 0


def mascara_de_fundo(rgb: np.ndarray) -> np.ndarray:
    """True onde há xadrez: manchas largas de cinza, mais tudo que se liga a elas."""
    altura, largura = rgb.shape[:2]

    luminancia = rgb.mean(axis=2)
    croma = rgb.max(axis=2) - rgb.min(axis=2)
    candidato = (
        (luminancia >= FUNDO_MIN) & (luminancia <= FUNDO_MAX) & (croma <= CROMA_MAXIMA)
    )

    fundo = np.zeros((altura, largura), dtype=bool)
    fila: deque[tuple[int, int]] = deque()

    def semear(y: int, x: int) -> None:
        if candidato[y, x] and not fundo[y, x]:
            fundo[y, x] = True
            fila.append((y, x))

    for y, x in zip(*np.nonzero(manchas_largas(candidato))):
        semear(int(y), int(x))

    for x in range(largura):
        semear(0, x)
        semear(altura - 1, x)
    for y in range(altura):
        semear(y, 0)
        semear(y, largura - 1)

    while fila:
        y, x = fila.popleft()
        if y > 0:
            semear(y - 1, x)
        if y + 1 < altura:
            semear(y + 1, x)
        if x > 0:
            semear(y, x - 1)
        if x + 1 < largura:
            semear(y, x + 1)

    return fundo


def recortar(imagem: Image.Image) -> Image.Image:
    """Tira a moldura vazia: o enquadramento do editor vale para a arte, não para o vazio."""
    caixa = imagem.getchannel("A").getbbox()
    if caixa is None:
        raise SystemExit("A arte saiu inteira transparente — confira a faixa de fundo.")

    esquerda, topo, direita, baixo = caixa
    return imagem.crop(
        (
            max(0, esquerda - MARGEM),
            max(0, topo - MARGEM),
            min(imagem.width, direita + MARGEM),
            min(imagem.height, baixo + MARGEM),
        )
    )


def main() -> None:
    original = Image.open(ORIGEM).convert("RGB")
    rgb = np.asarray(original).astype(np.float32)

    fundo = mascara_de_fundo(rgb)

    alfa = Image.fromarray(np.where(fundo, 0, 255).astype(np.uint8), mode="L")
    alfa = alfa.filter(ImageFilter.MinFilter(ENCOLHER))
    alfa = alfa.filter(ImageFilter.GaussianBlur(FEATHER))

    selo = original.copy()
    selo.putalpha(alfa)
    selo = recortar(selo)
    selo = selo.quantize(colors=CORES, method=Image.FASTOCTREE)
    selo.save(DESTINO, format="PNG", optimize=True)

    print(f"{ORIGEM.name}: {original.width}×{original.height}")
    print(f"xadrez removido: {100 * fundo.mean():.1f}% da área original")
    print(f"{DESTINO.relative_to(RAIZ.parent)}: {selo.width}×{selo.height}")
    print(f"tamanho: {DESTINO.stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()
