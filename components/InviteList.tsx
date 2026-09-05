"use client";

import { useRouter } from "next/navigation";
import { MailOpen } from "lucide-react";
import { useRef, useState } from "react";
import { respondInvite } from "@/app/invitaciones/actions";
import Avatar from "@/components/Avatar";
import FormMessage from "@/components/FormMessage";
import YesNo from "@/components/YesNo";
import { shortDate } from "@/lib/dates";
import type { PendingInvite } from "@/lib/notifications";
import { collapse, useListMotion } from "@/lib/motion";

/** Qué podrá hacer quien acepte. Es la única letra pequeña que trae la fila. */
const ROLES: Record<PendingInvite["role"], string> = {
  editor: "Podrás comentar",
  viewer: "Podrás mirar, sin comentar",
};

/**
 * Las invitaciones que esperan respuesta.
 *
 * Cada fila dice tres cosas y ninguna más: quién te invita, a qué proyecto y qué
 * vas a poder hacer dentro. Lo demás —cuándo se mandó, con qué correo— es dato
 * de archivo: no cambia la respuesta, así que no ocupa línea. La fecha se queda
 * en el `title` del nombre del proyecto, por si alguna vez hace falta.
 *
 * Contestar no es optimista. Aceptar te mete en un proyecto ajeno y rechazar
 * borra la invitación para siempre, así que la fila no se va hasta que la base
 * dice que sí: si RLS lo rechazara, se habría desvanecido algo que sigue ahí. Lo
 * que sí es inmediato es que los dos botones se apagan, para que dos clics
 * seguidos no manden dos respuestas.
 */
export default function InviteList({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);
  useListMotion(list);

  // Cuál se está contestando. Solo una a la vez: son viajes a la base con
  // consecuencias, y encadenarlos deja la pantalla sin decir cuál iba cuál.
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Las que ya se contestaron y se están yendo. Se guardan aparte para que la
  // fila siga pintada mientras se encoge y no desaparezca de golpe.
  const [gone, setGone] = useState<string[]>([]);

  async function answer(invite: PendingInvite, accept: boolean, row: HTMLLIElement | null) {
    if (busy) return;
    setBusy(invite.id);
    setFailure(null);

    const result = await respondInvite(invite.id, accept);
    setBusy(null);

    if (result.error) {
      setFailure(result.error);
      return;
    }

    // La fila se encoge y solo entonces se descuenta: ver irse la que se acaba
    // de contestar es lo que dice qué respondió la base, que puede tardar
    // décimas. `router.refresh` trae el panel con el proyecto nuevo dentro.
    collapse(row, () => {
      setGone((before) => [...before, invite.id]);
      router.refresh();
    });
  }

  const showing = invites.filter((invite) => !gone.includes(invite.id));

  if (showing.length === 0) return <NoInvites />;

  return (
    <>
      {failure && <FormMessage className="mt-6">{failure}</FormMessage>}

      <ul ref={list} className="mt-6 grid max-w-page gap-2">
        {showing.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            busy={busy === invite.id}
            // Con una en vuelo, las demás también se apagan: la respuesta a esta
            // puede cambiar lo que se ve, y aceptar dos a ciegas no es una cosa
            // que nadie quiera hacer de verdad.
            blocked={busy !== null && busy !== invite.id}
            onAnswer={answer}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * La pantalla cuando no hay ninguna invitación esperando.
 *
 * No se explica nada porque no hay nada que explicar: quien llega aquí y no
 * tiene invitaciones no necesita un párrafo sobre cómo funcionarían si las
 * tuviera, necesita saber en un vistazo que ha mirado y estaba vacío. Por eso la
 * frase se queda sola en el eje del cristal, con el titular arriba haciendo de
 * rótulo y sitio de sobra alrededor: el vacío se dice con aire.
 *
 * El sobre abierto debajo es el mismo objeto que marca la sección en el carril,
 * solo que abierto y sin nada dentro, y sale del mismo juego de iconos que todo
 * lo demás. Va en piedra de oliva y con el trazo bajado a 1.5: a 96px el grosor
 * de siempre se convierte en un dibujo que pesa más que la frase.
 *
 * La frase va del mismo gris que el sobre y no del negro de los titulares. Es
 * del tamaño de un titular porque tiene que verse desde la puerta, pero no dice
 * nada: no hay nada que leer ni nada que hacer, y en negro pesaría más que el
 * nombre de la sección, que sí manda. En gris se ve igual de lejos y se queda
 * en su sitio.
 */
function NoInvites() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
      <p className="text-heading text-olive-stone">Parece que no hay nada por aquí</p>
      <MailOpen aria-hidden size={96} strokeWidth={1.5} className="text-olive-stone" />
    </div>
  );
}

function InviteRow({
  invite,
  busy,
  blocked,
  onAnswer,
}: {
  invite: PendingInvite;
  busy: boolean;
  blocked: boolean;
  onAnswer: (invite: PendingInvite, accept: boolean, row: HTMLLIElement | null) => void;
}) {
  const row = useRef<HTMLLIElement>(null);
  const who = invite.inviter?.name || "Alguien";

  return (
    // El identificador es de la invitación y no de su posición: lo que la lista
    // necesita para recolocarse es cuál es cuál cuando una se va.
    <li
      ref={row}
      data-shift-id={invite.id}
      className="flex items-center gap-4 rounded-card border border-soft-mist px-4 py-4"
    >
      {invite.inviter ? (
        <Avatar
          avatar={invite.inviter.avatar}
          name={invite.inviter.name}
          email={invite.inviter.email}
          size={40}
        />
      ) : (
        // Quien invitó se dio de baja. La invitación sigue valiendo —el proyecto
        // existe y el sitio en la base está—, así que se contesta igual.
        <span aria-hidden className="size-10 shrink-0 rounded-full bg-soft-mist" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-body">
          <strong className="font-semibold">{who}</strong> te invita a{" "}
          <strong className="font-semibold" title={`Invitación de ${shortDate(invite.createdAt)}`}>
            {invite.projectName}
          </strong>
        </p>
        <p className="truncate font-mono text-caption text-olive-stone">
          {invite.siteHost} · {ROLES[invite.role]}
        </p>
      </div>

      <YesNo
        what={`la invitación a ${invite.projectName}`}
        busy={busy || blocked}
        onYes={() => onAnswer(invite, true, row.current)}
        onNo={() => onAnswer(invite, false, row.current)}
      />
    </li>
  );
}
