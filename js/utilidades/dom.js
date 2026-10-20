export const $ = id => document.getElementById(id);

// Deja solo dígitos mientras se escribe (cédulas, celulares, documentos)
export function soloDigitos(input){
  input.addEventListener("input", ev => { ev.target.value = ev.target.value.replace(/\D/g,""); });
}

// Muestra u oculta el error de un campo. Devuelve true si no hay error.
export function marcarError(input, errEl, texto){
  errEl.textContent = texto || "";
  if (texto) input.setAttribute("aria-invalid","true"); else input.removeAttribute("aria-invalid");
  return !texto;
}

// Desactiva un botón mientras dura una operación y le pone un texto de espera
export async function conEspera(boton, texto, tarea){
  const antes = boton.textContent;
  boton.disabled = true; boton.textContent = texto;
  try { return await tarea(); }
  finally { boton.disabled = false; boton.textContent = antes; }
}
