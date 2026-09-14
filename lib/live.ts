"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Avatar } from "@/lib/avatar";
import { realtimeClient } from "@/lib/supabase/browser";

/**
 * Alguien que tiene el proyecto abierto ahora mismo.
 *
 * Esto no se guarda en ninguna tabla y no debería: no es un dato del proyecto,
 * es un hecho que dura lo que dura una pestaña abierta. Vive en el canal de
 * presencia de Supabase, que lo sostiene mientras haya conexión y lo retira solo
 * cuando se corta —incluido el portátil que se cierra sin despedirse, que es el
 * caso que una tabla de «visto por última vez» nunca acierta a limpiar.
 *
 * Lo que viaja está resuelto y es lo mínimo. El color de una persona y el lavado
 * de su cara salen de su correo (`lib/author-color.ts`), pero el correo no sale
 * de aquí: quien emite ya hace esa cuenta y manda el resultado, igual que hace
 * `toMark` con las marcas que van dentro de la página revisada. Así el canal
 * —que es público, y ahí está explicado por qué: `lib/supabase/browser.ts`— no
 * lleva más de lo que cualquiera que pueda abrir el proyecto ya tiene delante.
 */
export type Watcher = {
  /** Su identificador, que es además la clave con la que entra en el canal. */
  id: string;
  name: string;
  /** Su cara, con el lavado ya elegido: sin correo no se podría deducir. */
  avatar: Avatar;
  /** Y su color, el mismo con el que se perfilan sus marcas sobre el sitio. */
  tint: string;
  /** En qué página del sitio está. Un proyecto tiene tantas como se visiten. */
  page: string;
};

/** Nombre del canal. Uno por proyecto: lo vivo es de todo el equipo. */
function roomFor(projectId: string): string {
  return `presence:project:${projectId}`;
}

/**
 * El aviso de que los comentarios del proyecto acaban de cambiar.
 *
 * Va vacío a propósito, y esa es la decisión de diseño de todo esto: por el
 * canal no viaja ni una palabra escrita por nadie, solo «vuelve a preguntar».
 * Quien lo recibe pide la lista otra vez con su propia sesión, así que lo que se
 * pinta es lo que la base le deja ver y no lo que dijo un mensaje. Las dos
 * razones, enteras, están en `refreshComments`.
 */
const CHANGED = "comments-changed";

type LiveOptions = {
  projectId: string;
  /** Quién eres tú para los demás, ya resuelto. */
  me: Watcher;
  /** Alguien del equipo tocó los comentarios: toca volver a pedirlos. */
  onChanged: () => void;
};

type Live = {
  /** Quién más está mirando, sin ti. */
  watchers: Watcher[];
  /** Decirle al equipo que acabas de tocar los comentarios. */
  announce: () => void;
};

/**
 * Lo vivo de un proyecto: quién lo está mirando y qué acaba de cambiar.
 *
 * Las dos cosas comparten canal, y no por ahorrar. Un canal es un socket y una
 * suscripción, y son exactamente la misma gente: quien está en la sala es quien
 * tiene que enterarse de lo que pasa en la sala. Separarlos sería abrir dos
 * conexiones para preguntar dos veces por el mismo corro.
 *
 * De la presencia se devuelve a los demás y nunca a uno mismo: quien pregunta ya
 * sabe que está aquí. La clave de presencia es el identificador de la persona y
 * no la conexión, así que dos pestañas de la misma cuenta son una sola cara en
 * la fila y no dos —abrir el sitio en otra ventana para compararlo es justo lo
 * que se hace en esta pantalla, y sería absurdo que se leyera como dos personas.
 *
 * El canal se abre una vez por proyecto y sobrevive a navegar por el sitio: lo
 * que cambia al saltar de página es el anuncio, no la conexión. Volver a
 * suscribirse en cada salto haría parpadear la fila entera —todos se irían y
 * volverían— cada vez que alguien pulsa un enlace dentro del iframe.
 */
export function useLive({ projectId, me, onChanged }: LiveOptions): Live {
  const [watchers, setWatchers] = useState<Watcher[]>([]);

  // El canal se monta una vez y sus manejadores se quedan con lo de aquel
  // render. Esta copia es la que sí está al día cuando hay que anunciarse otra
  // vez o cuando llega un aviso, que es el mismo apaño que usa `Workspace` con
  // los comentarios.
  const latest = useRef({ me, onChanged });
  useEffect(() => {
    latest.current = { me, onChanged };
  }, [me, onChanged]);

  const room = useRef<RealtimeChannel | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    const supabase = realtimeClient();
    if (!supabase || !projectId || !me.id) return;

    const channel = supabase.channel(roomFor(projectId), {
      config: {
        presence: { key: me.id },
        // Lo que uno mismo manda no vuelve: quien escribe ya pintó su comentario
        // con lo que le devolvió la base, y volver a pedir la lista por su propio
        // aviso sería una consulta que no puede traer nada nuevo.
        broadcast: { self: false },
      },
    });

    // Basta con `sync`: llega tanto al entrar como cada vez que alguien aparece,
    // se va o cambia de página. Escuchar además `join` y `leave` sería pintar la
    // misma fila dos veces por el mismo hecho.
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Watcher>();
      const here: Watcher[] = [];

      for (const [id, entries] of Object.entries(state)) {
        if (id === latest.current.me.id) continue;
        // De varias pestañas de la misma persona, la última que se anunció: es
        // la que dice en qué página está mirando de verdad.
        const entry = entries[entries.length - 1];
        if (!entry?.name || !entry.avatar) continue;
        here.push({ id, name: entry.name, avatar: entry.avatar, tint: entry.tint, page: entry.page });
      }

      // Por nombre y no por orden de llegada: el orden de llegada cambiaría la
      // fila entera de sitio cada vez que alguien recarga, y lo que hay que
      // reconocer aquí es una cara en el sitio donde estaba hace un momento.
      here.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      setWatchers(here);
    });

    channel.on("broadcast", { event: CHANGED }, () => latest.current.onChanged());

    channel.subscribe((status) => {
      joined.current = status === "SUBSCRIBED";
      // Anunciarse antes de estar dentro no llega a ningún sitio, y hacerlo dos
      // veces tampoco molesta: `track` reemplaza lo anunciado, no lo acumula.
      if (joined.current) void channel.track(latest.current.me);
    });

    room.current = channel;

    return () => {
      joined.current = false;
      room.current = null;
      // La fila se vacía a mano: si el canal se cierra por un cambio de proyecto,
      // dejar las caras puestas sería enseñar a gente que ya no se está oyendo.
      setWatchers([]);
      void supabase.removeChannel(channel);
    };
  }, [projectId, me.id]);

  // Navegar por el sitio no reabre el canal, solo corrige lo anunciado: es lo
  // que hace que la fila pueda decir quién está en esta página y quién en otra.
  useEffect(() => {
    if (!room.current || !joined.current) return;
    void room.current.track(latest.current.me);
  }, [me.page]);

  /**
   * Sin canal no hay a quién avisar, y no pasa nada: quien escribió ya tiene su
   * comentario en pantalla, y a los demás les llegará cuando recarguen. Esto es
   * lo que hace que la aplicación siga entera sin Realtime —que es también lo
   * que se ve mientras la conexión va y viene—, en vez de dejar una escritura a
   * medias por no poder contarla.
   */
  const announce = useCallback(() => {
    if (!room.current || !joined.current) return;
    void room.current.send({ type: "broadcast", event: CHANGED });
  }, []);

  return { watchers, announce };
}
