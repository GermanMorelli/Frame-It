/**
 * El servidor OAuth de Supabase, del lado de la aplicación.
 *
 * Con eso encendido en el panel, el proyecto de Supabase deja de ser solo la
 * puerta de Frame It y pasa a ser además una autoridad para terceros: una
 * aplicación ajena —un cliente MCP, otra herramienta— pide un testigo para
 * actuar EN NOMBRE de quien tiene la sesión, con los permisos que enumere. Quien
 * concede eso es la persona, y la pantalla donde lo concede la ponemos nosotros:
 * es lo que el panel llama Authorization Path y aquí es `app/oauth/consent`.
 *
 * Aquí están las dos piezas de esa pantalla que no son ni interfaz ni llamada a
 * Supabase: comprobar lo que llega por la dirección, y traducir los permisos a
 * algo que se pueda leer ANTES de concederlos, que es lo único que distingue un
 * consentimiento de un botón.
 */

/**
 * El identificador de una solicitud de autorización, tal y como lo reparte
 * Supabase: un UUID y nada más.
 *
 * Se comprueba antes de preguntar por él por lo mismo que el testigo de invitado
 * (`app/invitado/[token]/page.tsx`): lo que va en la dirección lo escribe
 * cualquiera, y pegar una cadena arbitraria a la URL de la API es pedir un error
 * que no tiene por qué parecerse al de una solicitud caducada.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const id = typeof first === "string" ? first.trim() : "";
  return UUID.test(id) ? id : null;
}

/** El identificador que trae la petición, o null si no es uno. */
export function authorizationId(value: unknown): string | null {
  return uuid(value);
}

/**
 * Y el de la aplicación a la que se le retira un permiso desde `/cuenta`, que
 * tiene la misma forma y llega por el mismo sitio: un campo de formulario que
 * escribe el navegador.
 */
export function clientId(value: unknown): string | null {
  return uuid(value);
}

/**
 * Qué se lleva quien pide cada permiso.
 *
 * Los de aquí son los de OpenID Connect, que significan lo mismo en todas
 * partes. Los demás los define quien registró la aplicación, y desde aquí no hay
 * forma de saber qué quieren decir: por eso lo desconocido no se calla ni se
 * maquilla con una frase de relleno, sale su nombre tal cual. Un permiso que no
 * sabemos explicar es justo el que hay que enseñar sin adornos.
 */
const SCOPES: Record<string, string> = {
  openid: "Saber que eres tú: el identificador de tu cuenta, nada más.",
  profile: "Tu nombre y tu cara, los mismos que ve el equipo en cada comentario tuyo.",
  email: "Tu dirección de correo.",
  phone: "Tu número de teléfono.",
  offline_access: "Volver a entrar por su cuenta, sin preguntarte otra vez, hasta que lo retires.",
};

export type Scope = {
  /** El nombre técnico, el que viaja en la solicitud. */
  id: string;
  /** Qué significa, o null si es uno que aquí no se sabe explicar. */
  text: string | null;
};

/**
 * Los permisos que se piden, en el orden en que vienen y sin repetir. Supabase
 * los manda como una sola cadena separada por espacios.
 */
export function describeScopes(scope: string | null | undefined): Scope[] {
  const seen = new Set<string>();
  const list: Scope[] = [];

  for (const id of (scope ?? "").trim().split(/\s+/)) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({ id, text: SCOPES[id] ?? null });
  }

  return list;
}

/**
 * Traduce lo que contesta el servidor OAuth cuando algo va mal.
 *
 * Casi todo lo que puede fallar aquí no es culpa de quien mira la pantalla —la
 * solicitud caducó, el servidor está apagado en el panel—, así que el texto dice
 * qué pasó y qué hacer, y en lo que es configuración dice dónde se toca. Es el
 * mismo reparto que `explain` en `lib/account.ts`.
 */
export function explainOAuth(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("not found") || text.includes("404")) {
    return "Esta solicitud ya no existe: o caducó, o ya la contestaste. Vuelve a empezar desde la aplicación que te trajo.";
  }
  if (text.includes("expired")) {
    return "La solicitud caducó. Vuelve a empezar desde la aplicación que te trajo.";
  }
  if (text.includes("disabled") || text.includes("not enabled") || text.includes("501")) {
    return "El servidor OAuth está apagado en el proyecto de Supabase (Authentication → OAuth Server).";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  }

  return `No se pudo completar: ${message}`;
}
