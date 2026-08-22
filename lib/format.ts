/** Formatação de valores para exibição. */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : 1).replace(".", ",")} ${units[index]}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "−" : value < 0 ? "+" : "";
  return `${sign}${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  por: "Português",
  eng: "Inglês",
  spa: "Espanhol",
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}
