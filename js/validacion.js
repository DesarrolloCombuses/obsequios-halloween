import { EDAD_MAX } from "./config.js";

// Reglas de la campaña. Cada validador devuelve el mensaje de error, o "" si el valor es válido.
// El servidor repite estas reglas (supabase/migrations) y además revisa los duplicados contra la base.

// Empleado (acudiente). El nombre y el cargo los trae el servidor con la cédula.
export const validarCedula = cc =>
  /^\d{6,10}$/.test(cc) ? "" : "Escribe una cédula de 6 a 10 dígitos.";

export const validarCelular = cel =>
  /^3\d{9}$/.test(cel) ? "" : "Escribe un celular de 10 dígitos que empiece por 3.";

export const validarAutorizacion = autorizado =>
  autorizado ? "" : "Se necesita la autorización para inscribir a los menores.";

// Niño o niña. "repetido": el mismo nombre ya está en otra tarjeta de esta inscripción.
export const validarNombreNino = (nombres, { repetido }) =>
  nombres.length < 5 ? "Escribe nombres y apellidos."
  : repetido ? "Este niño o niña está repetido en esta inscripción."
  : "";

// "ed" es la edad elegida en años, o null si no se eligió
export const validarEdad = ed =>
  ed === null ? "Selecciona la edad."
  : Number.isInteger(ed) && ed >= 0 && ed <= EDAD_MAX ? ""
  : "Solo reciben obsequio niños de 0 a " + EDAD_MAX + " años.";

export const validarSexo = sexo =>
  sexo ? "" : "Selecciona para quién es el obsequio.";

export const validarParentesco = parentesco =>
  parentesco ? "" : "Selecciona el parentesco.";

// Respuestas del servidor que se muestran en un campo
export const MENSAJE_NO_EMPLEADO = "Esta cédula no aparece como empleado activo de Combuses. Si crees que es un error, comunícate con Gestión Humana.";
export const MENSAJE_ACUDIENTE_DUPLICADO = "Ya tienes una inscripción con esta cédula. Si necesitas agregar o corregir niños, comunícate con Combuses.";
export const MENSAJE_DEMASIADAS_CONSULTAS = "Hiciste muchas consultas seguidas. Espera unos minutos e intenta de nuevo.";
