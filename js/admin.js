// Punto de entrada del panel del equipo (admin.html): inicio de sesión y listado de inscripciones
import { $ } from "./utilidades/dom.js";
import { configurado, MENSAJE_SIN_CONFIGURAR } from "./servicios/supabase.js";
import { sesionActual, salir, esAdmin } from "./servicios/sesion.js";
import { prepararDescargas } from "./servicios/exportacion.js";
import { iniciarAcceso } from "./componentes/acceso.js";
import { iniciarListado, cargarListado, activarTiempoReal, desactivarTiempoReal } from "./componentes/listado.js";
import { mostrarMensaje } from "./componentes/mensajes.js";
import { iniciarPWA } from "./pwa.js";

function mostrar(vista){
  $("acceso").classList.toggle("hidden", vista !== "acceso");
  $("panel").classList.toggle("hidden", vista !== "panel");
}

// Abre el listado si hay sesión de un administrador; si no, muestra el inicio de sesión
async function abrirPanel(){
  try {
    const sesion = await sesionActual();
    if (!sesion){ mostrar("acceso"); return; }
    if (!(await esAdmin())){
      await salir();
      mostrar("acceso");
      mostrarMensaje("err","El usuario " + sesion.user.email + " no tiene permiso para ver las inscripciones.");
      return;
    }
    $("usuario").textContent = sesion.user.email;
    mostrar("panel");
    await cargarListado();
    activarTiempoReal();
  } catch(e){
    mostrar("acceso");
    mostrarMensaje("err","No se pudo conectar con la base de datos. Revisa tu conexión e intenta de nuevo.");
  }
}

iniciarPWA();

if (!configurado){
  mostrarMensaje("err", MENSAJE_SIN_CONFIGURAR);
} else {
  iniciarAcceso({ alEntrar: abrirPanel });
  iniciarListado();
  prepararDescargas();
  $("salir").addEventListener("click", async () => {
    desactivarTiempoReal();
    await salir().catch(() => {});
    $("mensaje").classList.add("hidden");
    mostrar("acceso");
  });
  abrirPanel();
}
