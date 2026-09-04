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

/** Concordancia de número, que en una lista de cuentas salta a la vista. */
export function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}
