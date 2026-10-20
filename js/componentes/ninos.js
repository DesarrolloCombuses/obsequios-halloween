import { EDAD_MAX, MAX_NINOS } from "../config.js";
import { $ } from "../utilidades/dom.js";
import { txtEdad } from "../utilidades/fechas.js";

// Tarjetas de niños: una por cada niño o niña de la inscripción, clonadas de <template id="tplNino">
const cont = $("ninos");
let seq = 0;

// Opciones de edad de la plantilla: de "Menos de 1 año" a EDAD_MAX años
const selectorEdad = $("tplNino").content.querySelector('[data-campo="edad"]');
for (let e = 0; e <= EDAD_MAX; e++) selectorEdad.add(new Option(txtEdad(e), String(e)));

export const campo = (card, nombre) => card.querySelector('[data-campo="' + nombre + '"]');
export const errorDe = (card, nombre) => card.querySelector('[data-error="' + nombre + '"]');
export const tarjetas = () => [...cont.children];

export function agregarNino(){
  const card = $("tplNino").content.firstElementChild.cloneNode(true);
  const uid = "n" + (seq++);
  card.querySelectorAll("[data-campo]").forEach(el => {
    el.id = uid + "-" + el.dataset.campo;
    const lab = card.querySelector('[data-for="' + el.dataset.campo + '"]');
    if (lab) lab.htmlFor = el.id;
  });
  card.querySelector("[data-quitar]").addEventListener("click", () => { card.remove(); renumerar(); });
  cont.appendChild(card);
  renumerar();
  return card;
}

// Deja una sola tarjeta vacía (después de inscribir)
export function reiniciarNinos(){
  cont.textContent = "";
  agregarNino();
}

function renumerar(){
  const cards = tarjetas();
  cards.forEach((card, i) => {
    card.querySelector("[data-titulo]").textContent = "Niño o niña " + (i + 1);
    card.querySelector("[data-quitar]").classList.toggle("hidden", cards.length === 1);
  });
  $("agregar").classList.toggle("hidden", cards.length >= MAX_NINOS);
  $("resumen").textContent = cards.length === 1 ? "1 niño o niña en esta inscripción." : cards.length + " niños en esta inscripción.";
}
