"use client";

import { useState } from "react";
import { avatarSrc, type Avatar as AvatarSpec } from "@/lib/avatar";
import { authorColor, washById, washOf } from "@/lib/author-color";

type AvatarProps = {
  /** El estilo y la semilla de esta persona: lo que la dibuja. */
  avatar: AvatarSpec;
  /** Su nombre. Es la inicial de debajo y lo que se dice de la imagen. */
  name: string;
  /**
   * Su correo, que es de donde salen su color y —mientras no elija otro— su
   * fondo. Sin él se recurre al nombre: lo importante es que la clave sea
   * siempre la misma persona.
   */
  email?: string;
  /** Lado en píxeles. Un avatar es un disco, así que es alto y ancho a la vez. */
  size?: number;
  /**
   * Aro del color con el que se perfilan sus marcas sobre el sitio revisado. Solo
   * donde ese color significa algo que está a la vista —la lista del equipo, la
   * columna de comentarios—, nunca en el chrome de la aplicación (DESIGN.md).
   */
  ring?: boolean;
  className?: string;
};

/**
 * La cara de una persona.
 *
 * Debajo hay siempre un disco del lavado pastel que le toca, con su inicial en
 * tinta. Encima cae el dibujo, que trae ese mismo lavado por fondo: por eso aquí
 * no hay entrada que animar —a diferencia de la portada de un sitio, que sí se
 * funde sobre su lavado (`SiteThumb`)— porque el color no es el hueco de una
 * imagen que falta, es el fondo del propio avatar. Lo que llega es una cara
 * sobre un disco que ya estaba, sin salto de color y sin mover nada de sitio.
 *
 * Y por eso mismo no hay estado de carga que diseñar ni error que anunciar: si
 * el servicio no contesta —o está apagado a propósito—, lo que queda es el disco
 * con la inicial, que ya distingue a ocho personas en una lista. Un avatar es
 * información de apoyo; nadie merece una fila de aviso por un dibujo.
 */
export default function Avatar({
  avatar,
  name,
  email,
  size = 24,
  ring = false,
  className = "",
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // La misma clave para el lavado y para el aro: si el color de alguien saliera
  // de dos cuentas distintas, serían dos identidades y no una.
  const key = email || name;
  const initial = name.trim().charAt(0) || "·";

  // El fondo elegido, y si no hay ninguno el que le toca por su clave. Se
  // resuelve aquí y no antes porque las dos caras del lavado tienen que salir
  // de la misma cuenta: la clase pinta el disco y el hexadecimal viaja en la
  // petición, y separarlas devolvería el canto de color al llegar la imagen.
  const wash = avatar.bg ? washById(avatar.bg) : washOf(key);

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${wash.class} ${className}`}
    >
      <span
        style={{ fontSize: Math.round(size * 0.42) }}
        className="font-vend font-semibold uppercase leading-none text-midnight-ink"
      >
        {initial}
      </span>

      {!failed && (
        /*
         * `<img>` y no `next/image`: el optimizador de Next iría a buscar la
         * imagen por su cuenta, sin las cookies de quien mira, y `/api/avatar`
         * exige sesión —le contestaría 401 a todas. Tampoco hay nada que
         * optimizar en un SVG de dos kilobytes que escala solo.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc(avatar, wash.hex)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {ring && (
        // Va por dentro y no por fuera: un aro exterior cambiaría el tamaño del
        // disco, y estos se alinean con texto en filas de 24px.
        <span
          style={{ boxShadow: `inset 0 0 0 2px ${authorColor(key)}` }}
          className="pointer-events-none absolute inset-0 rounded-full"
        />
      )}
    </span>
  );
}
