// Punto de entrada del formulario público
import { iniciarFormulario } from "./componentes/formulario.js";
import { vigilarPlazo } from "./componentes/plazo.js";
import { mostrarMensaje } from "./componentes/mensajes.js";
import { configurado, MENSAJE_SIN_CONFIGURAR } from "./servicios/supabase.js";
import { iniciarPWA } from "./pwa.js";

iniciarPWA();
iniciarFormulario();
vigilarPlazo();
if (!configurado) mostrarMensaje("err", MENSAJE_SIN_CONFIGURAR);
