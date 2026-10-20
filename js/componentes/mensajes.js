import { $ } from "../utilidades/dom.js";

// Aviso general arriba del formulario. tipo: "ok" o "err"
export function mostrarMensaje(tipo, texto){
  const m = $("mensaje");
  m.className = "msg " + tipo; m.textContent = texto;
  m.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center"});
}
