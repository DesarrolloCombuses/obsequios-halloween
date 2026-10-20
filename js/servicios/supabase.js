import { SUPABASE_URL, SUPABASE_CLAVE_PUBLICA } from "../config.js";

// La librería se carga solo cuando se necesita: si el CDN falla, el formulario igual funciona y el error sale al guardar
const LIBRERIA = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";

export const configurado = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_CLAVE_PUBLICA.includes("TU-CLAVE");
export const MENSAJE_SIN_CONFIGURAR = "La aplicación todavía no está conectada a la base de datos: falta poner la URL y la clave de Supabase en js/config.js.";

let cliente = null;
export function obtenerCliente(){
  if (!configurado) return Promise.reject(new Error(MENSAJE_SIN_CONFIGURAR));
  if (!cliente){
    cliente = import(LIBRERIA)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICA))
      .catch(e => { cliente = null; throw e; });
  }
  return cliente;
}
