"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import Avatar from "@/components/Avatar";
import type { Member } from "@/lib/projects";
import { FIELD } from "@/lib/ui";

/**
 * El carácter que abre una mención, y lo que puede ir detrás mientras se
 * escribe. Sin espacios: el nombre puede tener dos palabras, pero se busca por
 * la primera y la segunda la pone la lista al elegir. Aceptar espacios en la
 * búsqueda haría que cualquier arroba suelta a mitad de una frase se pasara el
 * resto del comentario intentando ser una mención.
 */
const OPEN = /@([\p{L}\p{N}._-]*)$/u;

/** Cuántos caben sin que la lista tape el comentario que se está escribiendo. */
const LIMIT = 6;

/** Quita acentos y baja a minúsculas: "Adrián" tiene que salir tecleando "adrian". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Los identificadores de los mencionados que siguen estando en el texto.
 *
 * Se comprueba al guardar y no al elegir, y esa es toda la idea: elegir a
 * alguien de la lista no es un compromiso, es escribir su nombre. Si luego se
 * borra media frase y el nombre se va con ella, la mención se va también, sin
 * que haya que llevar la cuenta de nada mientras se escribe.
 */
export function mentionsIn(text: string, picked: Member[]): string[] {
  const found = picked
    .filter((member) => text.includes(`@${member.name}`))
    .map((member) => member.userId);
  return [...new Set(found)];
}

type MentionBoxProps = {
  value: string;
  onChange: (value: string) => void;
  /** A quién se puede señalar: el equipo del proyecto, sin uno mismo. */
  members: Member[];
  /** Se avisa de cada elegido para que el formulario sepa a quién resolver. */
  onPick: (member: Member) => void;
  /** El del formulario. Solo llega cuando la lista está cerrada. */
  onEscape: () => void;
  field: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * El campo del comentario, con menciones.
 *
 * Un comentario en una revisión casi nunca es para todos: es para quien tiene
 * que tocar eso. Hasta aquí la única forma de decirlo era escribir el nombre
 * dentro del texto y confiar en que esa persona volviera a entrar y lo leyera.
 * La arroba convierte esa frase en un aviso —le sale en su bandeja, con el
 * comentario y un camino hasta el elemento— sin cambiar cómo se escribe.
 *
 * Lo que se guarda son identificadores y no el texto (`comments.mentions`), así
 * que quien se cambie el nombre mañana sigue siendo el mencionado ayer. Y a
 * quién se avisa de verdad lo decide la base: el disparador solo avisa a quien
 * sea miembro del proyecto, porque esta lista viaja desde el navegador y podría
 * traer cualquier cosa (migración 0006).
 */
export default function MentionBox({
  value,
  onChange,
  members,
  onPick,
  onEscape,
  field,
  disabled,
  placeholder,
}: MentionBoxProps) {
  const listId = useId();
  // Dónde empieza la arroba que se está escribiendo, y qué se lleva tecleado.
  // Null es que no hay ninguna abierta: el texto es texto y nada más.
  const [query, setQuery] = useState<{ at: number; text: string } | null>(null);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    if (!query) return [];
    const needle = fold(query.text);
    return members
      .filter((member) => !needle || fold(member.name).includes(needle))
      .slice(0, LIMIT);
  }, [members, query]);

  const open = query !== null && matches.length > 0;

  /** Mira lo que hay justo antes del cursor: si es una arroba abierta, la abre. */
  function track(text: string, caret: number) {
    const found = OPEN.exec(text.slice(0, caret));
    if (!found) {
      setQuery(null);
      return;
    }

    const at = caret - found[0].length;
    // Mover el cursor dentro de la misma arroba no es escribir. Sin esta
    // comparación, cada pulsación crearía un objeto nuevo y la lista se
    // repintaría sin haber cambiado nada de lo que enseña —y volvería a señalar
    // el primero, deshaciendo la flecha que se acaba de pulsar.
    if (query && query.at === at && query.text === found[1]) return;

    setQuery({ at, text: found[1] });
    setCursor(0);
  }

  /** Cambia la arroba a medias por el nombre entero y deja el cursor detrás. */
  function pick(member: Member) {
    if (!query) return;

    const caret = field.current?.selectionStart ?? value.length;
    // El espacio del final no es cosmético: sin él, seguir escribiendo alarga el
    // nombre y la mención dejaría de encontrarse en el texto al guardar.
    const inserted = `@${member.name} `;
    const next = value.slice(0, query.at) + inserted + value.slice(caret);

    onChange(next);
    onPick(member);
    setQuery(null);

    // Después de que React pinte el valor nuevo: antes, el campo todavía tiene
    // el viejo y mover el cursor no serviría de nada.
    const to = query.at + inserted.length;
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(to, to);
    });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!open) {
      // Sin lista, Escape es del formulario: descarta el borrador.
      if (event.key === "Escape") onEscape();
      return;
    }

    if (event.key === "Escape") {
      // Con la lista abierta, Escape la cierra y no toca el borrador: se cierra
      // lo último que se abrió, que es lo que espera cualquiera.
      event.preventDefault();
      event.stopPropagation();
      setQuery(null);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setCursor((here) => (here + step + matches.length) % matches.length);
      return;
    }

    // Enter elige, y por eso no manda el formulario: mientras la lista está
    // abierta, la tecla contesta a la lista. Tab hace lo mismo, que es lo que
    // hace en cualquier autocompletado.
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(matches[cursor]);
    }
  }

  return (
    <div ref={box} className="relative">
      <textarea
        ref={field}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          track(event.target.value, event.target.selectionStart);
        }}
        // Moverse con las flechas o con el ratón también cambia lo que hay antes
        // del cursor: sin esto, la lista seguiría abierta lejos de su arroba.
        onSelect={(event) => {
          const target = event.target as HTMLTextAreaElement;
          track(target.value, target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setQuery(null)}
        disabled={disabled}
        rows={4}
        maxLength={4000}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${cursor}` : undefined}
        className={`resize-none ${FIELD}`}
      />

      {open && (
        // Debajo del campo y por encima de todo: la columna tiene su propio
        // scroll, y una lista que empujara el formulario movería el sitio donde
        // se está escribiendo justo mientras se escribe.
        <ul
          id={listId}
          role="listbox"
          aria-label="Personas del proyecto"
          className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-card border border-midnight-ink bg-paper-white p-1"
        >
          {matches.map((member, index) => (
            <li key={member.userId} role="none">
              <button
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === cursor}
                type="button"
                // `onMouseDown` y no `onClick`: al pulsar, el campo pierde el
                // foco antes del clic y el `onBlur` de arriba ya habría cerrado
                // la lista, así que el clic caería en el vacío.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(member);
                }}
                onPointerMove={() => setCursor(index)}
                className={`flex w-full items-center gap-2 rounded-button px-2 py-1.5 text-left transition ${
                  index === cursor ? "bg-soft-mist" : ""
                }`}
              >
                <Avatar
                  avatar={member.avatar}
                  name={member.name}
                  email={member.email}
                  size={20}
                />
                <span className="min-w-0 flex-1 truncate text-label">{member.name}</span>
                {member.role === "viewer" && (
                  // Quien solo mira no puede contestar, así que señalarle es
                  // pedirle algo que no puede hacer desde donde lo va a leer.
                  <span className="label-xs shrink-0 text-olive-stone">solo mira</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
