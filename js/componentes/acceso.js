import { $, marcarError, conEspera } from "../utilidades/dom.js";
import { entrar } from "../servicios/sesion.js";
import { mostrarMensaje } from "./mensajes.js";

// Formulario de inicio de sesión del panel. alEntrar: se llama cuando la sesión quedó abierta.
export function iniciarAcceso({ alEntrar }){
  const form = $("acceso");
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    if ($("entrar").disabled) return;
    const correo = $("correo").value.trim(), clave = $("clave").value;
    const okCorreo = marcarError($("correo"), $("e-correo"), /^\S+@\S+\.\S+$/.test(correo) ? "" : "Escribe tu correo.");
    const okClave = marcarError($("clave"), $("e-clave"), clave ? "" : "Escribe tu contraseña.");
    if (!okCorreo){ $("correo").focus(); return; }
    if (!okClave){ $("clave").focus(); return; }

    try {
      await conEspera($("entrar"), "Entrando…", () => entrar(correo, clave));
    } catch(e){
      const credenciales = e.code === "invalid_credentials" || /invalid login/i.test(e.message || "");
      mostrarMensaje("err", credenciales ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.");
      return;
    }
    form.reset();
    $("mensaje").classList.add("hidden");
    await alEntrar();
  });
}
