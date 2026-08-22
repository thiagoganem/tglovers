# Marca da campanha

Fonte da arte usada no módulo **Foto de perfil**. Nada aqui é servido: o que vai
para o navegador é o `public/selo.png` gerado a partir daqui.

| Arquivo | O que é |
| --- | --- |
| `selo-original.jpeg` | Como a arte chegou: JPEG, com o xadrez de transparência **desenhado nos pixels**. |
| `gerar-selo.py` | Transforma esse xadrez em transparência de verdade e escreve `public/selo.png`. |

O JPEG não tem canal alfa, então o quadriculado cinza que o editor de imagem
mostra no lugar do vazio virou parte da imagem quando alguém exportou. Colada
sobre uma foto, a arte apareceria dentro de um retângulo quadriculado. O script
reconhece esse fundo e o apaga — o detalhe de como está no cabeçalho dele.

Quando a arte mudar:

```bash
python3 marca/gerar-selo.py
```

Precisa de `numpy` e `Pillow`. O PNG resultante é versionado junto com o código:
gerar durante o build custaria Python dentro da imagem Docker do frontend por
causa de um arquivo que muda uma vez por campanha.
