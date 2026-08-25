"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileIcon, FileUploadIcon, TrashIcon } from "./icons";
import { formatBytes } from "@/lib/format";
import { gerarMiniatura, type Miniatura } from "@/lib/miniatura";

/** Um arquivo escolhido, com identidade própria. */
export type Escolhido = { id: string; file: File };

export function novoEscolhido(file: File): Escolhido {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, file };
}

type DropzoneProps = {
  /** Extensões aceitas, no formato `.pdf`. */
  accept: string[];
  /** Rótulos exibidos ao usuário (PDF, JPG, …). */
  labels: string[];
  /** Limite para a **soma** dos arquivos. */
  maxBytes: number;
  /** Quantos arquivos cabem em um envio. */
  maxFiles: number;
  /** Alvo de tamanho da saída, exibido na nota inferior. */
  targetBytes: number;
  itens: Escolhido[];
  /** `false` quando o envio vai processar cada arquivo separadamente: a
   * ordem deixa de importar e a reorganização sai de cena. */
  juntar?: boolean;
  disabled?: boolean;
  onItens: (itens: Escolhido[]) => void;
  onReject: (message: string) => void;
};

/**
 * Área de arrastar e soltar, com miniatura de cada arquivo.
 *
 * Aceita vários de uma vez e mantém a ordem visível — ela é a ordem das
 * páginas no PDF final, então precisa ser tanto vista quanto mudada aqui.
 *
 * A validação daqui é só de conveniência (resposta imediata); a real, inclusive
 * por assinatura binária do conteúdo, acontece no servidor.
 */
export function Dropzone({
  accept,
  labels,
  maxBytes,
  maxFiles,
  targetBytes,
  itens,
  juntar = true,
  disabled = false,
  onItens,
  onReject,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const miniaturas = useMiniaturas(itens);

  /** Nome em edição, por item: `{ id, valor }` enquanto o campo está aberto. */
  const [edicao, setEdicao] = useState<{ id: string; valor: string } | null>(null);

  /** Índice do cartão sendo arrastado, e onde ele cairia agora. */
  const [arrastado, setArrastado] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);

  const validar = useCallback(
    (candidato: File, jaEscolhidos: Escolhido[]): string | null => {
      const extensao = candidato.name.slice(candidato.name.lastIndexOf(".")).toLowerCase();
      if (!accept.includes(extensao)) {
        return `${candidato.name}: formato não suportado. Envie ${labels.join(", ")}.`;
      }
      if (candidato.size === 0) return `${candidato.name}: o arquivo está vazio.`;

      const soma = jaEscolhidos.reduce((total, item) => total + item.file.size, 0);
      if (soma + candidato.size > maxBytes) {
        return `Os arquivos somam mais que o limite de ${formatBytes(maxBytes)}.`;
      }
      return null;
    },
    [accept, labels, maxBytes],
  );

  const receber = useCallback(
    (lista: FileList | null) => {
      const novos = Array.from(lista ?? []);
      if (novos.length === 0) return;

      const aceitos = [...itens];
      let recusa: string | null = null;

      for (const candidato of novos) {
        if (aceitos.length >= maxFiles) {
          recusa = `Máximo de ${maxFiles} arquivos por envio.`;
          break;
        }
        const erro = validar(candidato, aceitos);
        if (erro) {
          recusa = erro;
          continue;
        }
        aceitos.push(novoEscolhido(candidato));
      }

      if (aceitos.length !== itens.length) onItens(aceitos);
      if (recusa) onReject(recusa);
    },
    [itens, maxFiles, onItens, onReject, validar],
  );

  const abrir = () => !disabled && inputRef.current?.click();

  const remover = (id: string) => onItens(itens.filter((item) => item.id !== id));

  /**
   * Fecha a edição do nome de um item, se houver algo a fechar.
   *
   * O nome do arquivo é o nome do PDF que vai ser baixado — é ele que sobe no
   * envio e o servidor usa para batizar a saída. A extensão original é
   * mantida à força: sem ela, a detecção de tipo no servidor se perderia.
   * Cancelar (Esc ou campo vazio) devolve o nome que já estava.
   */
  const confirmarNome = (id: string) => {
    const item = itens.find((candidato) => candidato.id === id);
    if (!item || edicao?.id !== id) return;

    const extensao = item.file.name.slice(item.file.name.lastIndexOf(".")).toLowerCase();
    const limpo = edicao.valor.replace(/[\\/]/g, " ").trim().slice(0, 120);
    setEdicao(null);
    if (!limpo || limpo === item.file.name) return;

    const nome = limpo.toLowerCase().endsWith(extensao) ? limpo : `${limpo}${extensao}`;
    const renomeado = new File([item.file], nome, {
      type: item.file.type,
      lastModified: item.file.lastModified,
    });
    onItens(itens.map((candidato) => (candidato.id === id ? { ...candidato, file: renomeado } : candidato)));
  };

  const mover = (indice: number, direcao: -1 | 1) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= itens.length) return;
    const copia = [...itens];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onItens(copia);
  };

  /** Tira o cartão de `de` e o encaixa em `para`, empurrando o resto. */
  const reordenar = (de: number, para: number) => {
    if (de === para) return;
    const copia = [...itens];
    const [movido] = copia.splice(de, 1);
    copia.splice(para, 0, movido);
    onItens(copia);
  };

  const encerrarArrasto = () => {
    setArrastado(null);
    setAlvo(null);
  };

  const total = itens.reduce((soma, item) => soma + item.file.size, 0);

  const entrada = (
    <input
      ref={inputRef}
      type="file"
      className="visually-hidden"
      accept={accept.join(",")}
      multiple
      disabled={disabled}
      onChange={(event) => {
        receber(event.target.files);
        event.target.value = ""; // permite reescolher o mesmo arquivo
      }}
    />
  );

  /**
   * O arrasto é de arquivos vindos de fora, e não de um cartão da própria lista?
   *
   * Sem essa distinção, reordenar acenderia a moldura de "solte os arquivos
   * aqui" e terminaria num `receber()` sem arquivo nenhum.
   */
  const vemDeFora = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  // Os manipuladores de arrasto valem nos dois estados (vazio e preenchido).
  const arrasto = {
    onDragEnter: (event: React.DragEvent) => {
      if (!vemDeFora(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: React.DragEvent) => {
      if (vemDeFora(event)) event.preventDefault();
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!vemDeFora(event)) return;
      event.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      if (!vemDeFora(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (!disabled) receber(event.dataTransfer.files);
    },
  };

  if (itens.length === 0) {
    return (
      <div
        className={`dropzone${dragging ? " dropzone--active" : ""}`}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        aria-label="Área para arrastar e soltar os documentos"
        onClick={abrir}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrir();
          }
        }}
        {...arrasto}
      >
        <div className="dropzone__icon">
          <FileUploadIcon size={26} />
        </div>
        <div className="dropzone__title">
          {dragging ? "Solte os arquivos aqui" : "Arraste seus arquivos aqui"}
        </div>
        <div className="dropzone__subtitle">{labels.join(", ")}</div>
        <button
          type="button"
          className="button"
          style={{ marginTop: 14 }}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            abrir();
          }}
        >
          Selecionar arquivos
        </button>
        <div className="dropzone__note">
          vários viram um PDF só · até {formatBytes(targetBytes)} no arquivo final
        </div>
        {entrada}
      </div>
    );
  }

  return (
    <div className={`selecao${dragging ? " selecao--ativa" : ""}`} {...arrasto}>
      <div className="selecao__topo">
        <strong>
          {itens.length} arquivo{itens.length > 1 ? "s" : ""} · {formatBytes(total)}
        </strong>
        {itens.length > 1 && juntar && (
          <span className="selecao__ordem">
            viram um PDF só, nesta ordem — arraste para reorganizar
          </span>
        )}
        {itens.length > 1 && !juntar && (
          <span className="selecao__ordem">cada arquivo vira um PDF separado</span>
        )}
      </div>

      <ul className="arquivos">
        {itens.map((item, indice) => {
          const miniatura = miniaturas.get(item.id);
          const classes = [
            "arquivo",
            arrastado === indice ? "arquivo--arrastado" : "",
            alvo === indice && arrastado !== indice ? "arquivo--alvo" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li
              className={classes}
              key={item.id}
              draggable={
                !disabled && juntar && itens.length > 1 && edicao?.id !== item.id
              }
              onDragStart={(event) => {
                setArrastado(indice);
                event.dataTransfer.effectAllowed = "move";
                // Firefox só inicia o arrasto se algo for escrito aqui; o
                // valor em si não é lido, quem carrega o índice é o estado.
                event.dataTransfer.setData("text/plain", String(indice));
              }}
              onDragOver={(event) => {
                if (arrastado === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setAlvo(indice);
              }}
              onDrop={(event) => {
                if (arrastado === null) return;
                event.preventDefault();
                event.stopPropagation(); // não deixa virar "soltar arquivo"
                reordenar(arrastado, indice);
                encerrarArrasto();
              }}
              onDragEnd={encerrarArrasto}
            >
              <span className="arquivo__ordem">{indice + 1}</span>

              <div className="arquivo__thumb">
                {miniatura?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={miniatura.url} alt="" />
                ) : (
                  <FileIcon size={22} />
                )}
              </div>

              <input
                className="arquivo__nome arquivo__nome--editavel"
                value={edicao?.id === item.id ? edicao.valor : item.file.name}
                title="Nome do PDF que será baixado — clique para alterar"
                aria-label={`Nome do arquivo ${indice + 1}`}
                spellCheck={false}
                // O campo não pode virar alvo de arrasto nem começar a
                // reorganização: o gesto aqui é escrever, não mover.
                onDragStart={(evento) => evento.preventDefault()}
                onFocus={() => setEdicao({ id: item.id, valor: item.file.name })}
                onChange={(evento) => setEdicao({ id: item.id, valor: evento.target.value })}
                onBlur={() => confirmarNome(item.id)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") evento.currentTarget.blur();
                  if (evento.key === "Escape") {
                    setEdicao(null);
                    evento.currentTarget.blur();
                  }
                }}
              />
              <div className="arquivo__meta">
                {formatBytes(item.file.size)}
                {miniatura?.paginas && miniatura.paginas > 1
                  ? ` · ${miniatura.paginas} páginas`
                  : ""}
              </div>

              <div className="arquivo__acoes">
                <button
                  type="button"
                  className="icon-button icon-button--mini"
                  disabled={disabled || indice === 0}
                  onClick={() => mover(indice, -1)}
                  aria-label={`Mover ${item.file.name} para trás`}
                  title="Mover para trás"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--mini"
                  disabled={disabled || indice === itens.length - 1}
                  onClick={() => mover(indice, 1)}
                  aria-label={`Mover ${item.file.name} para frente`}
                  title="Mover para frente"
                >
                  →
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--mini icon-button--perigo"
                  disabled={disabled}
                  onClick={() => remover(item.id)}
                  aria-label={`Remover ${item.file.name}`}
                  title="Remover"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </li>
          );
        })}

        {itens.length < maxFiles && (
          <li>
            <button type="button" className="arquivo arquivo--novo" disabled={disabled} onClick={abrir}>
              <FileUploadIcon size={22} />
              <span>Adicionar</span>
            </button>
          </li>
        )}
      </ul>

      {entrada}
    </div>
  );
}

/**
 * Miniaturas dos itens atuais, geradas uma vez por arquivo.
 *
 * Gera só o que ainda não existe e revoga as URLs dos que saíram da lista —
 * sem isso, cada troca de arquivo deixaria um blob preso na memória da aba.
 */
function useMiniaturas(itens: Escolhido[]): Map<string, Miniatura> {
  const [miniaturas, setMiniaturas] = useState<Map<string, Miniatura>>(new Map());
  const vivas = useRef<Map<string, Miniatura>>(new Map());

  useEffect(() => {
    let cancelado = false;
    const idsAtuais = new Set(itens.map((item) => item.id));

    for (const [id, miniatura] of vivas.current) {
      if (!idsAtuais.has(id)) {
        if (miniatura.url) URL.revokeObjectURL(miniatura.url);
        vivas.current.delete(id);
      }
    }

    const pendentes = itens.filter((item) => !vivas.current.has(item.id));
    if (pendentes.length === 0) {
      setMiniaturas(new Map(vivas.current));
      return () => {
        cancelado = true;
      };
    }

    // Cada arquivo corre por conta própria: um PDF pesado não pode segurar a
    // miniatura das fotos que vieram depois dele. O que limita o paralelismo é
    // o navegador, e cada item já tem prazo próprio dentro de `gerarMiniatura`.
    for (const item of pendentes) {
      void gerarMiniatura(item.file).then((miniatura) => {
        if (cancelado) {
          if (miniatura.url) URL.revokeObjectURL(miniatura.url);
          return;
        }
        vivas.current.set(item.id, miniatura);
        setMiniaturas(new Map(vivas.current));
      });
    }

    return () => {
      cancelado = true;
    };
  }, [itens]);

  // Desmontagem: nada de blobs órfãos.
  useEffect(() => {
    const registro = vivas.current;
    return () => {
      for (const miniatura of registro.values()) {
        if (miniatura.url) URL.revokeObjectURL(miniatura.url);
      }
      registro.clear();
    };
  }, []);

  return miniaturas;
}
