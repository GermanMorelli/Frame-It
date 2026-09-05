/**
 * Fechas de la interfaz. Se formatean en el servidor y con zona horaria fija:
 * si el servidor y el navegador la resolvieran cada uno por su cuenta, React
 * avisaría de que el HTML pintado no coincide con el hidratado.
 */
const SHORT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : SHORT.format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

/** Los tramos, del más largo al más corto: se coge el primero en el que cabe. */
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/**
 * «hace 2 horas», para la bandeja de avisos.
 *
 * Solo se puede llamar desde el servidor, y por lo mismo que `SHORT` fija la
 * zona horaria: esto depende de la hora en que se pinta, así que el HTML del
 * servidor y el del navegador no coincidirían y React avisaría de ello. En un
 * aviso la fecha exacta no dice nada —lo que se quiere saber es si es de hoy—,
 * así que se pinta esto y la fecha entera se deja en el `title`.
 */
export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diff = date.getTime() - Date.now();
  for (const [unit, size] of STEPS) {
    if (Math.abs(diff) >= size) return RELATIVE.format(Math.round(diff / size), unit);
  }
  return "ahora mismo";
}

/** Concordancia de número, que en una lista de cuentas salta a la vista. */
export function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}
