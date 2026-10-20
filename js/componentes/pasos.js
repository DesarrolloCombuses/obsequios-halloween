import { $ } from "../utilidades/dom.js";

// Pasos de la inscripción: 1 cédula, 2 niños, 3 confirmar. Se muestra uno a la vez y arriba se marca el avance.
let actual = 1;

export const pasoActual = () => actual;

// enfocar: lleva la pantalla al formulario y el foco al título del paso (para lectores de pantalla)
export function irAPaso(n, { enfocar = true } = {}){
  actual = n;
  document.querySelectorAll("[data-paso]").forEach(s => s.classList.toggle("hidden", Number(s.dataset.paso) !== n));
  document.querySelectorAll("[data-paso-marca]").forEach(li => {
    const m = Number(li.dataset.pasoMarca);
    li.classList.toggle("hecho", m < n);
    if (m === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
  if (!enfocar) return;
  const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("form").scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  document.querySelector('[data-paso="' + n + '"] .paso-titulo').focus({ preventScroll: true });
}
