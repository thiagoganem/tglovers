"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, CheckIcon, CopyIcon, DownloadIcon, ScanIcon } from "./icons";
import { formatNumber } from "@/lib/format";
import type { RefineResult } from "@/lib/api";

type Snapshot = { text: string; caret: number };

/** Alterações separadas por menos que isso são agrupadas em um único desfazer. */
const UNDO_GROUP_MS = 600;
const MAX_HISTORY = 200;

type TextEditorProps = {
  initialText: string;
  filename: string;
  /**
   * Manda o texto inteiro para o servidor sincronizar o PDF. Vale para
   * qualquer edição — digitada à mão ou feita pela busca —, porque quem
   * descobre o que mudou é a comparação com as palavras do arquivo.
   */
  onAplicarNoPdf?: (texto: string) => Promise<RefineResult>;
};

/**
 * Editor do texto reconhecido.
 *
 * O histórico é mantido manualmente porque o `undo` nativo do navegador não
 * funciona de forma confiável em um `textarea` controlado pelo React.
 */
export function TextEditor({ initialText, filename, onAplicarNoPdf }: TextEditorProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialText);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  //: O texto tal como está hoje no PDF. Tudo que diferir dele está pendente de
  //: sincronização — não importa se veio da busca ou de digitação.
  const [sincronizado, setSincronizado] = useState(initialText);
  const [aplicando, setAplicando] = useState(false);
  const [retorno, setRetorno] = useState<RefineResult | null>(null);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  const history = useRef<{ stack: Snapshot[]; index: number; at: number }>({
    stack: [{ text: initialText, caret: 0 }],
    index: 0,
    at: 0,
  });

  // --- Histórico ---------------------------------------------------------
  const commit = useCallback((next: string, caret: number, group: boolean) => {
    const state = history.current;
    const now = Date.now();
    state.stack = state.stack.slice(0, state.index + 1);
    if (group && now - state.at < UNDO_GROUP_MS && state.stack.length > 1) {
      state.stack[state.index] = { text: next, caret };
    } else {
      state.stack.push({ text: next, caret });
      if (state.stack.length > MAX_HISTORY) state.stack.shift();
      state.index = state.stack.length - 1;
    }
    state.at = now;
  }, []);

  const restore = useCallback((snapshot: Snapshot) => {
    setText(snapshot.text);
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (!area) return;
      area.focus();
      area.setSelectionRange(snapshot.caret, snapshot.caret);
    });
  }, []);

  const undo = useCallback(() => {
    const state = history.current;
    if (state.index === 0) return;
    state.index -= 1;
    state.at = 0;
    restore(state.stack[state.index]);
  }, [restore]);

  const redo = useCallback(() => {
    const state = history.current;
    if (state.index >= state.stack.length - 1) return;
    state.index += 1;
    state.at = 0;
    restore(state.stack[state.index]);
  }, [restore]);

  const canUndo = history.current.index > 0;
  const canRedo = history.current.index < history.current.stack.length - 1;

  // --- Busca -------------------------------------------------------------
  const matches = useMemo(() => {
    if (!query) return [] as number[];
    const found: number[] = [];
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      found.push(at);
      from = at + Math.max(needle.length, 1);
    }
    return found;
  }, [query, text]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query]);

  const selectMatch = useCallback(
    (index: number) => {
      const area = areaRef.current;
      if (!area || matches.length === 0) return;
      const wrapped = ((index % matches.length) + matches.length) % matches.length;
      const start = matches[wrapped];
      setMatchIndex(wrapped);
      area.focus();
      area.setSelectionRange(start, start + query.length);
      // Aproxima o scroll da linha encontrada.
      const before = text.slice(0, start).split("\n").length - 1;
      const lineHeight = parseFloat(getComputedStyle(area).lineHeight || "22") || 22;
      area.scrollTop = Math.max(0, before * lineHeight - area.clientHeight / 2);
    },
    [matches, query.length, text],
  );

  const replaceCurrent = useCallback(() => {
    if (matches.length === 0) return;
    const start = matches[Math.min(matchIndex, matches.length - 1)];
    const next = text.slice(0, start) + replacement + text.slice(start + query.length);
    setText(next);
    commit(next, start + replacement.length, false);
  }, [commit, matchIndex, matches, query.length, replacement, text]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0) return;
    let next = "";
    let cursor = 0;
    for (const at of matches) {
      next += text.slice(cursor, at) + replacement;
      cursor = at + query.length;
    }
    next += text.slice(cursor);
    setText(next);
    commit(next, next.length, false);
  }, [commit, matches, query.length, replacement, text]);

  // --- Ações -------------------------------------------------------------
  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback para navegadores sem permissão de área de transferência.
      areaRef.current?.select();
      document.execCommand?.("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [text]);

  const aplicarNoPdf = useCallback(async () => {
    if (!onAplicarNoPdf) return;
    setAplicando(true);
    setErroPdf(null);
    try {
      const resultado = await onAplicarNoPdf(text);
      setRetorno(resultado);
      // O texto que volta é o do PDF corrigido — e é ele que passa a valer como
      // marco. Sem isso, a próxima edição seria comparada com um estado que o
      // arquivo já não tem, e o servidor tentaria refazer o que já foi feito.
      setSincronizado(resultado.text);
      if (resultado.text !== text) {
        setText(resultado.text);
        commit(resultado.text, resultado.text.length, false);
      }
    } catch (caught) {
      setErroPdf(
        caught instanceof Error ? caught.message : "Não foi possível aplicar no PDF.",
      );
    } finally {
      setAplicando(false);
    }
  }, [commit, onAplicarNoPdf, text]);

  const downloadTxt = useCallback(() => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.replace(/\.pdf$/i, "") + ".txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filename, text]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      redo();
    }
  };

  const dirty = text !== initialText;
  //: O que ainda não chegou ao arquivo. É a diferença para o PDF, não para o
  //: texto original: depois de aplicar, o marco passa a ser o PDF corrigido.
  const pendente = text !== sincronizado;

  return (
    <div>
      <div className="editor__toolbar">
        <div className="editor__search">
          <input
            className="input"
            placeholder="Pesquisar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                selectMatch(matchIndex + (event.shiftKey ? -1 : 1));
              }
            }}
            aria-label="Pesquisar no texto"
          />
          <input
            className="input"
            placeholder="Substituir por"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            aria-label="Substituir por"
          />
          <span className="editor__matches">
            {query ? (matches.length ? `${matchIndex + 1}/${matches.length}` : "0") : ""}
          </span>
        </div>

        <button
          type="button"
          className="button button--outline button--small"
          onClick={() => selectMatch(matchIndex + 1)}
          disabled={matches.length === 0}
        >
          Próximo
        </button>
        <button
          type="button"
          className="button button--outline button--small"
          onClick={replaceCurrent}
          disabled={matches.length === 0}
        >
          Substituir
        </button>
        <button
          type="button"
          className="button button--outline button--small"
          onClick={replaceAll}
          disabled={matches.length === 0}
        >
          Todos
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          className="button button--outline button--small"
          onClick={undo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
        >
          Desfazer
        </button>
        <button
          type="button"
          className="button button--outline button--small"
          onClick={redo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Shift+Z)"
        >
          Refazer
        </button>
      </div>

      {onAplicarNoPdf && (
        <div className="correcoes">
          <span className="correcoes__estado">
            {pendente
              ? "Há alterações que ainda não estão no PDF."
              : "O PDF está igual ao texto acima."}
          </span>

          <span style={{ flex: 1 }} />

          <button
            type="button"
            className="button button--brand button--small"
            onClick={aplicarNoPdf}
            disabled={aplicando || !pendente}
          >
            <ScanIcon size={15} />
            {aplicando ? "Aplicando…" : "Aplicar no PDF"}
          </button>

          {pendente && (
            <button
              type="button"
              className="button button--outline button--small"
              onClick={() => {
                setText(sincronizado);
                commit(sincronizado, sincronizado.length, false);
                setRetorno(null);
              }}
              disabled={aplicando}
            >
              Descartar alterações
            </button>
          )}

          {erroPdf && (
            <span className="alert alert--danger" style={{ width: "100%" }}>
              <AlertIcon size={16} />
              <span>{erroPdf}</span>
            </span>
          )}

          {retorno && !erroPdf && (
            <span
              className={`alert alert--${retorno.applied ? "success" : "warning"}`}
              style={{ width: "100%" }}
            >
              {retorno.applied ? <CheckIcon size={16} /> : <AlertIcon size={16} />}
              <span>
                {retorno.applied > 0
                  ? `${retorno.applied} trecho${retorno.applied > 1 ? "s" : ""} reescrito${
                      retorno.applied > 1 ? "s" : ""
                    } no PDF. Confira na aba Visualizar.`
                  : "O PDF já estava igual ao texto — nada a reescrever."}
                {retorno.fontChanged > 0 &&
                  ` Em ${retorno.fontChanged} deles a fonte original não estava
                   embutida no arquivo, então foi usada a mais parecida.`}
                {retorno.sizeReduced > 0 &&
                  ` ${retorno.sizeReduced} não cabia${retorno.sizeReduced > 1 ? "m" : ""} na
                   linha e teve${retorno.sizeReduced > 1 ? "ram" : ""} de encolher um pouco.`}
                {retorno.truncated &&
                  " O texto tinha alterações demais e parte ficou de fora; aplique de novo para seguir."}
              </span>
            </span>
          )}
        </div>
      )}

      <textarea
        ref={areaRef}
        className="editor__area"
        value={text}
        spellCheck
        onKeyDown={onKeyDown}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          commit(next, event.target.selectionStart, true);
        }}
        aria-label="Texto reconhecido"
      />

      <div className="editor__footer">
        <span>
          {formatNumber(text.length)} caracteres
          {dirty ? " · editado" : ""}
          {onAplicarNoPdf && pendente && " · fora do PDF até aplicar"}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="button button--outline button--small" onClick={copyAll}>
            <CopyIcon size={15} />
            {copied ? "Copiado!" : "Copiar texto"}
          </button>
          <button
            type="button"
            className="button button--outline button--small"
            onClick={downloadTxt}
          >
            <DownloadIcon size={15} />
            Baixar .txt
          </button>
        </span>
      </div>
    </div>
  );
}
