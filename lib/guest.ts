import { AVATAR_STYLES, rollSeed, type Avatar } from "@/lib/avatar";
import { ALL_WASHES } from "@/lib/author-color";

/**
 * Cómo se llama y con qué cara aparece alguien que entró por un enlace de
 * invitado.
 *
 * Un invitado no tiene cuenta, así que no tiene nada de lo que la aplicación
 * saca una identidad para los demás: ni nombre escrito en el alta, ni correo del
 * que salga su color, ni una cara elegida en la pantalla de la cuenta. Y hace
 * falta darle las tres cosas, porque sin ellas la columna de comentarios sería
 * una lista de tarjetas idénticas sin firma —«alguien dijo esto, alguien dijo
 * aquello»— y no se sabría si tres comentarios son de tres personas o de una
 * que escribió tres veces. Eso es justo lo que hay que saber al leerlos.
 *
 * Podría pedírsele el nombre al entrar, y a propósito no se hace: es un campo
 * más entre el enlace y el primer comentario, se rellena con «asdf» la mitad de
 * las veces, y encima invita a escribir el nombre de otro. Un nombre sorteado no
 * dice quién eres —eso el invitado no lo prometió— pero sí dice que eres siempre
 * el mismo, que es lo único que la lista necesita.
 *
 * El nombre se compone de un sujeto y un adjetivo: «Náufrago Puntual», «Bruma
 * Curiosa». Dos palabras que se leen a la primera, se recuerdan durante la
 * revisión y se pueden decir en voz alta en una reunión, que es más de lo que
 * hace un identificador. Cincuenta por cincuenta son dos mil quinientos, y dos
 * invitados que se llamen igual no son dos identidades confundidas: son dos
 * caras distintas con el mismo rótulo, y tienen distinto color de marca.
 *
 * Esto se sortea una sola vez, al darle el alta (`app/invitado/actions.ts`), y
 * viaja en la metadata de la cuenta como el nombre y la cara de cualquiera. Así
 * el invitado se llama igual al recargar, en otra página del sitio y al volver
 * al día siguiente con la misma sesión.
 */

/**
 * Los sujetos, en masculino. Son sujetos y no nombres de persona: un invitado no
 * es un «Carlos» inventado —eso sería suplantar a alguien que existe— sino una
 * figura, que es lo que de verdad es en la conversación del proyecto.
 */
const SUBJECTS_M = [
  "Faro",
  "Náufrago",
  "Cartógrafo",
  "Centinela",
  "Alquimista",
  "Titiritero",
  "Relojero",
  "Farolero",
  "Vagabundo",
  "Escriba",
  "Peregrino",
  "Cronista",
  "Espantapájaros",
  "Contrabandista",
  "Deshollinador",
  "Trapecista",
  "Buzo",
  "Jardinero",
  "Astrónomo",
  "Boticario",
  "Grumete",
  "Ermitaño",
  "Pescador",
  "Tipógrafo",
  "Panadero",
  "Sonámbulo",
  "Almanaque",
  "Telescopio",
  "Cometa",
  "Acantilado",
  "Molino",
  "Bosque",
] as const;

/**
 * Y los femeninos, que van aparte por una razón de gramática y no de reparto: en
 * español el adjetivo concuerda con el sujeto, y «Bruma Curioso» no es un nombre,
 * es una errata. Separadas las dos listas, saber qué género tiene un sujeto es
 * saber de cuál de las dos salió.
 */
const SUBJECTS_F = [
  "Bruma",
  "Sirena",
  "Marea",
  "Veleta",
  "Brújula",
  "Linterna",
  "Cigarra",
  "Gaviota",
  "Ballena",
  "Lechuza",
  "Libélula",
  "Alondra",
  "Hoguera",
  "Duna",
  "Aurora",
  "Nebulosa",
  "Golondrina",
  "Medusa",
] as const;

/** Los cincuenta, en un solo montón: el sorteo no distingue género. */
const SUBJECTS = [...SUBJECTS_M, ...SUBJECTS_F] as const;

/**
 * Los adjetivos, en masculino singular.
 *
 * La lista está elegida para que la regla de concordancia de `feminine` sea
 * completa: los que cambian de género acaban todos en -o («Curioso» → «Curiosa»)
 * y el resto es invariable («Errante», «Sagaz», «Puntual»). No hay ni un
 * «Holgazán» ni un «Soñador», que pedirían cada uno su propia excepción.
 *
 * Ninguno es un insulto ni un juicio: al invitado no se le pone el nombre para
 * hacer una broma a su costa, y quien lo lleva no lo eligió.
 */
const ADJECTIVES = [
  "Curioso",
  "Furtivo",
  "Silencioso",
  "Distraído",
  "Meticuloso",
  "Errático",
  "Perplejo",
  "Solemne",
  "Errante",
  "Insomne",
  "Sutil",
  "Amable",
  "Sagaz",
  "Audaz",
  "Locuaz",
  "Tenaz",
  "Veloz",
  "Fugaz",
  "Perspicaz",
  "Cordial",
  "Puntual",
  "Singular",
  "Estelar",
  "Elegante",
  "Elocuente",
  "Paciente",
  "Prudente",
  "Vehemente",
  "Risueño",
  "Pensativo",
  "Terco",
  "Sereno",
  "Nocturno",
  "Lejano",
  "Diminuto",
  "Inquieto",
  "Impávido",
  "Melancólico",
  "Testarudo",
  "Callado",
  "Bohemio",
  "Intrépido",
  "Vespertino",
  "Diáfano",
  "Rotundo",
  "Esquivo",
  "Taciturno",
  "Ilustre",
  "Célebre",
  "Cándido",
] as const;

/**
 * Uno al azar de una lista.
 *
 * Con `crypto` y no con `Math.random` por lo mismo que la semilla de un avatar
 * (`rollSeed`): el nombre de un invitado es su identidad durante la revisión, y
 * dos personas que abren el mismo enlace en el mismo instante no deberían poder
 * salir iguales porque el generador arrancara del mismo sitio.
 *
 * El resto de la división introduce un sesgo de un valor entre cuatro mil
 * millones para una lista de cincuenta. Está muy por debajo de lo que significa
 * repetir: dos invitados con el mismo nombre.
 */
function pick<T>(list: readonly T[]): T {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return list[value % list.length];
}

/**
 * El adjetivo en femenino. La lista de arriba está hecha para que esto baste:
 * lo que acaba en -o cambia, y lo demás vale para los dos géneros.
 */
function feminine(adjective: string): string {
  return adjective.endsWith("o") ? `${adjective.slice(0, -1)}a` : adjective;
}

/** Un nombre de invitado: sujeto y adjetivo, concordados. */
export function guestName(): string {
  const subject = pick(SUBJECTS);
  const adjective = pick(ADJECTIVES);
  const isFeminine = (SUBJECTS_F as readonly string[]).includes(subject);
  return `${subject} ${isFeminine ? feminine(adjective) : adjective}`;
}

/**
 * Y una cara, también sorteada: estilo, semilla y fondo.
 *
 * Aquí se sortean las tres, y en una cuenta normal solo la semilla lo es —el
 * estilo es el de la casa y el fondo sale de su correo (`lib/avatar.ts`)—. La
 * diferencia no es capricho: un invitado no tiene correo del que sacar el fondo,
 * así que sin sortearlo todos saldrían con el mismo lavado, y el estilo de la
 * casa dejaría además a los invitados indistinguibles del equipo en la lista.
 * Sorteando los tres, dos invitados se diferencian a un metro de la pantalla.
 */
export function guestAvatar(): Avatar {
  return {
    style: pick(AVATAR_STYLES).id,
    seed: rollSeed(),
    bg: pick(ALL_WASHES).id,
  };
}
