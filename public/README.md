# Arquivos públicos

O que estiver aqui é servido pela raiz do site: `public/selo.png` vira
`https://seu-dominio/selo.png`.

## `selo.png` — a arte da aba "Foto de perfil"

A aba procura este arquivo ao abrir. Se ele existir, todo mundo já encontra o
selo posicionado e só precisa enviar a própria foto. Se não existir, a aba
continua funcionando, mas cada pessoa terá que enviar a arte por conta.

Requisitos:

- **PNG com fundo transparente.** Um JPG traz um retângulo branco junto.
- Quadrado ou horizontal, com pelo menos 1000px de largura — o arquivo final
  tem 1080px e uma arte menor sai serrilhada.
- Sem margem sobrando em volta: o espaçamento quem controla é o usuário, pelo
  tamanho e pela altura.

Para trocar a arte, substitua o arquivo e publique de novo.
