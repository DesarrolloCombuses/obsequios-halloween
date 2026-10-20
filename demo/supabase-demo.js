// MODO DE PRUEBA: demo/servidor-demo.py entrega este archivo en lugar de js/servicios/supabase.js.
// Imita las partes de supabase-js que usa la app (rpc, from, auth y channel) y le habla a ese servidor,
// que responde lo mismo que las funciones del SQL con empleados ficticios. No se publica.

export const configurado = true;
export const MENSAJE_SIN_CONFIGURAR = "";

const API = new URL("../../demo-api/", import.meta.url);
const CLAVE_SESION = "demo-halloween-sesion";
const REINTENTAR_MS = 3000;

function leerSesion(){
  try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch(e){ return null; }
}
function guardarSesion(sesion){
  try { sesion ? localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)) : localStorage.removeItem(CLAVE_SESION); } catch(e){}
}

// Responde como supabase-js: { data, error }, sin lanzar errores
async function llamar(ruta, cuerpo = {}, senal){
  try {
    const sesion = leerSesion();
    const r = await fetch(new URL(ruta, API), {
      method: "POST", signal: senal, body: JSON.stringify(cuerpo),
      headers: { "Content-Type": "application/json", ...(sesion ? { Authorization: "Bearer " + sesion.access_token } : {}) }
    });
    const datos = await r.json();
    return r.ok ? { data: datos, error: null } : { data: null, error: datos };
  } catch(e){
    return { data: null, error: { message: e.message || "Failed to fetch", name: e.name } };
  }
}

// supabase.from("acudientes"): listado por páginas y eliminar por id
class Consulta {
  constructor(){ this.borrar = false; this.desde = 0; this.hasta = 499; }
  select(){ return this; }
  order(){ return this; }
  range(desde, hasta){ this.desde = desde; this.hasta = hasta; return this; }
  delete(){ this.borrar = true; return this; }
  eq(columna, valor){ this.id = valor; return this; }
  then(ok, mal){
    const peticion = this.borrar ? llamar("eliminar", { id: this.id }) : llamar("listar", { desde: this.desde, hasta: this.hasta });
    return peticion.then(ok, mal);
  }
}

// supabase.channel(): en vez de Realtime, el servidor retiene la petición hasta que hay un cambio
function canal(){
  const manejadores = [];
  let activo = true, abortar = null, alEstado = () => {};
  return {
    on(tipo, filtro, fn){ manejadores.push(fn); return this; },
    subscribe(fn){
      alEstado = fn || alEstado;
      (async () => {
        let version = null, conectado = false;
        while (activo){
          abortar = new AbortController();
          const { data, error } = await llamar("esperar", { version }, abortar.signal);
          if (!activo) break;
          if (error){
            if (conectado){ conectado = false; alEstado("CHANNEL_ERROR"); }
            await new Promise(r => setTimeout(r, REINTENTAR_MS));
            continue;
          }
          const anterior = version;
          version = data.version;
          if (!conectado){ conectado = true; alEstado("SUBSCRIBED"); }
          if (anterior !== null && anterior !== version) manejadores.forEach(m => m({ eventType: "*" }));
        }
      })();
      return this;
    },
    cerrar(){ activo = false; if (abortar) abortar.abort(); alEstado("CLOSED"); }
  };
}

const cliente = {
  rpc: (nombre, params) => llamar("rpc/" + nombre, params || {}),
  from: () => new Consulta(),
  channel: () => canal(),
  removeChannel(c){ c.cerrar(); },
  auth: {
    async getSession(){
      const sesion = leerSesion();
      if (!sesion) return { data: { session: null }, error: null };
      const { data, error } = await llamar("sesion");
      if (error) return { data: { session: null }, error };
      if (!data.valida){ guardarSesion(null); return { data: { session: null }, error: null }; }  // el servidor se reinició
      return { data: { session: sesion }, error: null };
    },
    async signInWithPassword({ email, password }){
      const { data, error } = await llamar("entrar", { email, password });
      if (error) return { data: { session: null, user: null }, error };
      guardarSesion(data);
      return { data: { session: data, user: data.user }, error: null };
    },
    async signOut(){
      await llamar("salir");
      guardarSesion(null);
      return { error: null };
    }
  }
};

export const obtenerCliente = () => Promise.resolve(cliente);

// Aviso visible de que es una prueba, con los datos para probar
function llenar(id, valor){
  const campo = document.getElementById(id);
  campo.value = valor;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
}

function boton(texto, alTocar){
  const b = document.createElement("button");
  b.type = "button"; b.className = "demo-dato"; b.textContent = texto;
  b.addEventListener("click", alTocar);
  return b;
}

async function mostrarAviso(){
  const contenedor = document.querySelector(".wrap");
  if (!contenedor) return;
  const estilo = document.createElement("style");
  estilo.textContent = `
    .demo-aviso{margin:0 0 1.25rem;padding:.85rem 1rem;border:1px dashed var(--pumpkin);border-radius:1rem;background:rgba(255,138,31,.08);font-size:.9rem;line-height:1.45}
    .demo-aviso p{margin:0}
    .demo-aviso .demo-etiqueta{display:inline-block;margin-right:.4rem;padding:.15rem .55rem;border-radius:999px;background:var(--pumpkin);color:var(--pumpkin-ink);font:700 .72rem/1.4 var(--font-body);letter-spacing:.06em;text-transform:uppercase;vertical-align:.1em}
    .demo-datos{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.65rem}
    .demo-dato{min-height:2.5rem;padding:.35rem .8rem;border:1px solid var(--line-fuerte);border-radius:999px;background:rgba(255,255,255,.04);color:var(--ink);font:500 .85rem/1.25 var(--font-body);cursor:pointer;text-align:left}
    .demo-dato small{display:block;color:var(--muted);font-size:.75rem}
    @media(hover:hover){.demo-dato:hover{border-color:var(--pumpkin)}}`;
  document.head.append(estilo);

  const aviso = document.createElement("div");
  aviso.className = "demo-aviso";
  aviso.setAttribute("role", "note");
  const texto = document.createElement("p");
  const etiqueta = document.createElement("span");
  etiqueta.className = "demo-etiqueta"; etiqueta.textContent = "Prueba";
  texto.append(etiqueta, "Modo de prueba: no usa Supabase y los empleados son ficticios. Los datos se borran al cerrar el servidor.");
  aviso.append(texto);
  contenedor.prepend(aviso);

  const { data } = await llamar("info");
  if (!data) return;
  const datos = document.createElement("div");
  datos.className = "demo-datos";
  if (document.getElementById("ccAcudiente")){
    for (const e of data.empleados){
      const b = boton(e.cedula, () => llenar("ccAcudiente", e.cedula));
      const detalle = document.createElement("small");
      detalle.textContent = e.activo ? e.nombre.split(" ").slice(0, 2).join(" ") + (e.cargo ? "" : " · sin cargo") : "Retirado: debe rechazarla";
      b.append(detalle);
      datos.append(b);
    }
  } else if (document.getElementById("correo")){
    const b = boton("Llenar acceso de prueba", () => { llenar("correo", data.admin.correo); llenar("clave", data.admin.clave); });
    const detalle = document.createElement("small");
    detalle.textContent = data.admin.correo + " · " + data.admin.clave;
    b.append(detalle);
    datos.append(b);
  }
  aviso.append(datos);
}

mostrarAviso();
