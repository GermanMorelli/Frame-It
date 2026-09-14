"use client";

import { useEffect, useRef } from "react";
import Avatar from "@/components/Avatar";
import { pop } from "@/lib/motion";
import type { Watcher } from "@/lib/live";
import { pageLabel } from "@/lib/url";

/**
 * Cuántas caras caben antes de empezar a contar. Cuatro no es una cifra suelta:
 * la columna mide 320px y el disco 34, así que a partir de la quinta la fila
 * empujaría al rótulo fuera de la barra. Lo que sobra se dice con un número, que
 * es además lo único útil a partir de cierto punto —de siete caras no se
 * reconoce ninguna.
 */
const SHOWN = 4;

/** Lado del disco. Grande a propósito: ver quién está es lo que hace el trabajo. */
const SIZE = 34;

type WatchersProps = {
  /** Quién eres tú, que siempre estás: la fila nunca está vacía. */
  me: Watcher;
  /** Y los demás, en vivo. Puede estar vacío, y es lo normal. */
  others: Watcher[];
  /** La página que se ve aquí, para separar a quien mira lo mismo de quien no. */
  url: string;
};

/**
 * Quién está mirando el proyecto ahora mismo.
 *
 * Va arriba del todo, entre la dirección del sitio y el botón de comentar,
 * porque es lo primero que cambia lo que uno hace: comentar algo que otro está
 * mirando en este momento no es lo mismo que dejarlo escrito para mañana.
 *
 * Uno mismo va siempre el primero, y eso resuelve dos cosas a la vez. La de
 * fondo: la fila no aparece ni desaparece, así que el botón de debajo —el más
 * pulsado de la barra— no se mueve nunca de sitio cuando alguien entra o sale.
 * Y la de sentido: una sola cara suelta no diría de qué habla; la tuya al lado
 * de la de los demás dice que esto es la gente que está aquí, y no la lista del
 * equipo, que es otra pantalla y otra cosa.
 *
 * Cada disco lleva el aro del color de su dueño, el mismo con el que se perfilan
 * sus marcas sobre el sitio revisado: la fila de arriba y lo que se ve encima de
 * la página son la misma gente dicha dos veces, y el color es lo que las cose.
 * Aquí ese color sí es identidad y no chrome, que es la condición para usarlo
 * (DESIGN.md).
 *
 * Quien está en otra página del sitio se apaga a media tinta. Está mirando el
 * proyecto, pero no esto: enseñarlo igual de encendido sería prometer una
 * compañía que no está donde parece.
 */
export default function Watchers({ me, others, url }: WatchersProps) {
  const row = useRef<HTMLDivElement>(null);
  /** Quién ya estaba la última vez: lo que no esté aquí es que acaba de llegar. */
  const seen = useRef(new Set<string>());

  // El pellizco de bienvenida. Es el mismo con el que aparece cualquier pieza
  // pequeña del sistema (`pop`), y aquí dice lo único que hay que decir: esta
  // cara no estaba. Sin él, alguien entrando en el proyecto sería un disco más
  // que aparece en un sitio al que nadie está mirando.
  useEffect(() => {
    const root = row.current;
    if (!root) return;

    const present = new Set<string>();
    for (const node of root.querySelectorAll<HTMLElement>("[data-watcher]")) {
      const id = node.dataset.watcher ?? "";
      present.add(id);
      if (!seen.current.has(id)) pop(node);
    }
    // Se olvida a quien se fue: si vuelve, vuelve a ser una llegada.
    seen.current = present;
  }, [others]);

  const all = [me, ...others];
  const shown = all.slice(0, SHOWN);
  const rest = all.length - shown.length;

  // Nunca la lista entera: con seis nombres el rótulo dejaría de ser un rótulo.
  const caption =
    others.length === 0
      ? "Solo tú"
      : others.length === 1
        ? `Tú y ${others[0].name}`
        : `Tú y ${others.length} más`;

  return (
    <div className="mt-3 flex items-center gap-3">
      <div ref={row} className="flex items-center">
        {shown.map((watcher) => {
          const mine = watcher.id === me.id;
          const same = watcher.page === url;

          return (
            <span
              key={watcher.id}
              data-watcher={watcher.id}
              title={`${mine ? "Tú" : watcher.name} · ${same ? "en esta página" : pageLabel(watcher.page)}`}
              // El aro de papel no es adorno: los discos se solapan, y dos aros
              // de color pegados se leerían como uno solo de dos tintas. Va en
              // `outline`, que se pinta fuera de la caja sin ocupar sitio, así
              // que el solapamiento sigue midiendo lo que dice el margen.
              style={{ outline: "2px solid var(--color-paper-white)" }}
              className={`-ml-2 inline-flex rounded-full first:ml-0 ${same ? "" : "opacity-50"}`}
            >
              <Avatar
                avatar={watcher.avatar}
                name={watcher.name}
                tint={watcher.tint}
                size={SIZE}
                ring
              />
            </span>
          );
        })}

        {rest > 0 && (
          <span
            style={{ width: SIZE, height: SIZE, outline: "2px solid var(--color-paper-white)" }}
            className="label-xs -ml-2 inline-flex items-center justify-center rounded-full bg-soft-mist text-olive-stone"
          >
            +{rest}
          </span>
        )}
      </div>

      <span
        title={all.map((watcher) => (watcher.id === me.id ? "Tú" : watcher.name)).join(", ")}
        className="label-xs min-w-0 truncate text-olive-stone"
      >
        {caption}
      </span>
    </div>
  );
}
