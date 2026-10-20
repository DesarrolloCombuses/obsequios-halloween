"""Modo de prueba: la app completa SIN Supabase, para probarla antes de correr el SQL.

Uso (dentro de la carpeta de la app):
    python demo/servidor-demo.py          -> http://127.0.0.1:8091/
    python demo/servidor-demo.py 8095     -> otro puerto

Sirve la app tal cual, pero cambia js/servicios/supabase.js por demo/supabase-demo.js, que le habla a este servidor.
Este servidor responde lo mismo que las funciones del SQL (buscar_empleado, inscribir, es_admin, el listado,
eliminar, marcar_asistencia y el tiempo real) con empleados de prueba. Los datos viven en memoria y se borran al cerrar el servidor.
No se conecta a Supabase ni se publica.

Usa otro puerto que servidor-local.py para que la app de prueba y la real no compartan caché ni sesión.
"""
import http.server
import json
import os
import re
import secrets
import socket
import sys
import threading
import uuid
from datetime import datetime, timezone

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8091
DEMO = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(DEMO)

# Reglas de la campaña: las mismas de la función inscribir del SQL
EDAD_MAX, MAX_NINOS = 10, 10
PARENTESCOS = {"Hijo(a)", "Nieto(a)", "Sobrino(a)", "Hermano(a)", "Otro"}

# Empleados ficticios (hacen las veces de la tabla employees)
EMPLEADOS = [
    {"cedula": "1010101010", "nombre": "Ana María Pérez Gómez", "cargo": "Conductora", "activo": True},
    {"cedula": "80123456", "nombre": "Carlos Andrés Ruiz Díaz", "cargo": "Mecánico", "activo": True},
    {"cedula": "52987654", "nombre": "Luisa Fernanda Mora Castro", "cargo": None, "activo": True},
    {"cedula": "1020304050", "nombre": "Jorge Iván Torres Salas", "cargo": "Conductor", "activo": False},
]
ADMIN = {"correo": "admin@combuses.test", "clave": "halloween"}

ARRANQUE = secrets.token_hex(4)  # cambia en cada arranque: el panel abierto nota que los datos se borraron
familias = []                    # filas de acudientes, cada una con sus ninos
sesiones = {}                    # token -> correo
version = 0                      # sube con cada inscripción o eliminación (para el tiempo real)
cambio = threading.Condition()   # protege todo lo anterior y despierta a los paneles que esperan


def plazo():
    """El mismo plazo de js/config.js: si lo cambias ahí, el modo de prueba lo toma sin reiniciar."""
    texto = open(os.path.join(RAIZ, "js", "config.js"), encoding="utf-8").read()
    fecha = lambda clave: datetime.fromisoformat(re.search(clave + r':\s*new Date\("([^"]+)"\)', texto).group(1))
    return fecha("inicio"), fecha("cierre")


def abiertas():
    inicio, cierre = plazo()
    return inicio <= datetime.now(timezone.utc) <= cierre


def empleado_activo(cedula):
    return next((e for e in EMPLEADOS if e["activo"] and e["cedula"] == cedula), None)


def ya_inscrito(cedula):
    return any(f["cedula"] == cedula for f in familias)


def rechazo(codigo, **extra):
    return {"ok": False, "codigo": codigo, **extra}


def invalido(mensaje):
    return rechazo("datos_invalidos", mensaje=mensaje)


def texto(valor):
    return str(valor if valor is not None else "").strip()


def avisar_cambio():
    global version
    version += 1
    cambio.notify_all()


def es_admin(token):
    return sesiones.get(token) == ADMIN["correo"]


# --- Lo mismo que las funciones públicas del SQL -------------------------------------

def buscar_empleado(p, token):
    cedula = texto(p.get("p_cedula"))
    if not abiertas():
        return rechazo("fuera_de_plazo")
    if not re.fullmatch(r"[0-9]{6,10}", cedula):
        return invalido("Escribe una cédula de 6 a 10 dígitos.")
    e = empleado_activo(cedula)
    if not e:
        return rechazo("no_es_empleado")
    if ya_inscrito(cedula):
        return rechazo("acudiente_duplicado")
    return {"ok": True, "nombre": e["nombre"], "cargo": e["cargo"]}


def inscribir(p, token):
    acudiente, ninos = p.get("p_acudiente") or {}, p.get("p_ninos")
    cedula, celular = texto(acudiente.get("cedula")), texto(acudiente.get("celular"))
    if not abiertas():
        return rechazo("fuera_de_plazo")
    if not re.fullmatch(r"[0-9]{6,10}", cedula):
        return invalido("Escribe una cédula de 6 a 10 dígitos.")
    e = empleado_activo(cedula)
    if not e:
        return rechazo("no_es_empleado")
    if not re.fullmatch(r"3[0-9]{9}", celular):
        return invalido("Escribe un celular de 10 dígitos que empiece por 3.")
    if acudiente.get("autoriza") is not True:
        return invalido("Se necesita la autorización para inscribir a los menores.")
    if not isinstance(ninos, list) or not 1 <= len(ninos) <= MAX_NINOS:
        return invalido(f"Inscribe entre 1 y {MAX_NINOS} niños.")
    if ya_inscrito(cedula):
        return rechazo("acudiente_duplicado")

    filas, nombres = [], set()
    for i, n in enumerate(ninos, 1):
        nino = f"Niño o niña {i}: "
        if not isinstance(n, dict) or not 5 <= len(texto(n.get("nombres"))) <= 80:
            return invalido(nino + "escribe nombres y apellidos.")
        clave = re.sub(r"\s+", " ", texto(n["nombres"])).lower()
        if clave in nombres:
            return invalido(nino + "está repetido en esta inscripción.")
        nombres.add(clave)
        edad = texto(n.get("edad"))
        if not re.fullmatch(r"[0-9]{1,2}", edad) or int(edad) > EDAD_MAX:
            return invalido(nino + f"selecciona una edad de 0 a {EDAD_MAX} años.")
        if n.get("sexo") not in ("Niño", "Niña"):
            return invalido(nino + "selecciona para quién es el obsequio.")
        if n.get("parentesco") not in PARENTESCOS:
            return invalido(nino + "selecciona el parentesco.")
        filas.append({"id": str(uuid.uuid4()), "orden": i, "nombres": texto(n["nombres"]), "edad": int(edad), "sexo": n["sexo"],
                      "parentesco": n["parentesco"], "asistencia": None, "asistencia_en": None, "asistencia_por": None})

    familias.append({"id": str(uuid.uuid4()), "nombre": e["nombre"], "cargo": e["cargo"], "cedula": cedula, "celular": celular,
                     "creado_en": datetime.now(timezone.utc).isoformat(), "ninos": filas})
    avisar_cambio()
    return {"ok": True, "ninos": len(filas)}


# --- Inicio de sesión, listado, asistencia y tiempo real (lo que en Supabase hacen Auth, RLS y Realtime) ---

def entrar(p, token):
    if p.get("email") != ADMIN["correo"] or p.get("password") != ADMIN["clave"]:
        return 400, {"code": "invalid_credentials", "message": "Invalid login credentials"}
    nuevo = secrets.token_urlsafe(24)
    sesiones[nuevo] = ADMIN["correo"]
    return 200, {"access_token": nuevo, "user": {"id": "admin-demo", "email": ADMIN["correo"]}}


def salir(p, token):
    sesiones.pop(token, None)
    return {}


def listar(p, token):
    if not es_admin(token):
        return []  # como la seguridad por filas: sin permiso no hay filas
    desde, hasta = int(p.get("desde", 0)), int(p.get("hasta", 499))
    return familias[desde:hasta + 1]


def eliminar(p, token):
    fila = next((f for f in familias if f["id"] == p.get("id")), None)
    if not fila or not es_admin(token):
        return []
    familias.remove(fila)
    avisar_cambio()
    return [{"id": fila["id"]}]


def marcar_asistencia(p, token):
    """Como la función marcar_asistencia del SQL de asistencia: solo administradores."""
    if not es_admin(token):
        return 403, {"code": "42501", "message": "Solo el equipo puede marcar la asistencia."}
    estado = p.get("p_estado")
    if estado not in (None, "asistio", "no_asistio"):
        return 400, {"code": "22023", "message": f"Estado de asistencia inválido: {estado}"}
    ids = set(p.get("p_ninos") or [])
    ahora = datetime.now(timezone.utc).isoformat()
    marcados = 0
    for n in (n for f in familias for n in f["ninos"] if n["id"] in ids):
        n.update(asistencia=estado, asistencia_en=estado and ahora, asistencia_por=estado and sesiones[token])
        marcados += 1
    avisar_cambio()
    return marcados


def esperar(p, token):
    """Espera hasta 25 s a que haya un cambio y responde la versión actual de los datos."""
    actual = lambda: f"{ARRANQUE}-{version}"
    if p.get("version") == actual():
        cambio.wait(timeout=25)
    return {"version": actual()}


def info(p, token):
    """Datos de prueba para el aviso de la página."""
    return {"empleados": [{k: e[k] for k in ("cedula", "nombre", "cargo", "activo")} for e in EMPLEADOS], "admin": ADMIN}


ACCIONES = {
    "rpc/buscar_empleado": buscar_empleado,
    "rpc/inscribir": inscribir,
    "rpc/es_admin": lambda p, token: es_admin(token),
    "rpc/marcar_asistencia": marcar_asistencia,
    "entrar": entrar,
    "sesion": lambda p, token: {"valida": token in sesiones},
    "salir": salir,
    "listar": listar,
    "eliminar": eliminar,
    "esperar": esperar,
    "info": info,
}


class Manejador(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/js/servicios/supabase.js":
            with open(os.path.join(DEMO, "supabase-demo.js"), "rb") as f:
                return self.responder(200, f.read(), "text/javascript")
        super().do_GET()

    # La API usa POST para que el service worker de la app (que solo maneja GET) no la guarde en caché
    def do_POST(self):
        ruta = self.path.split("?")[0]
        accion = ACCIONES.get(ruta.removeprefix("/demo-api/")) if ruta.startswith("/demo-api/") else None
        if not accion:
            return self.send_error(404)
        try:
            cuerpo = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        except ValueError:
            return self.responder(400, b'{"message":"JSON invalido"}', "application/json")
        token = self.headers.get("Authorization", "").removeprefix("Bearer ")
        with cambio:
            resultado = accion(cuerpo, token)
        estado, datos = resultado if isinstance(resultado, tuple) else (200, resultado)
        self.responder(estado, json.dumps(datos, ensure_ascii=False).encode("utf-8"), "application/json")

    def responder(self, estado, cuerpo, tipo):
        self.send_response(estado)
        self.send_header("Content-Type", tipo + "; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, formato, *args):
        if "/demo-api/esperar" not in self.path:  # la espera del panel se repite cada 25 s
            super().log_message(formato, *args)


class Servidor(http.server.ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


def ip_en_la_red():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))  # no envía nada; solo elige la interfaz de salida
            return s.getsockname()[0]
    except OSError:
        return None


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print("MODO DE PRUEBA: sin Supabase, con empleados ficticios. Los datos se borran al cerrar.")
    print(f"Formulario: http://127.0.0.1:{PUERTO}/")
    print(f"Panel:      http://127.0.0.1:{PUERTO}/admin.html   ({ADMIN['correo']} / {ADMIN['clave']})")
    ip = ip_en_la_red()
    if ip:
        print(f"Celular:    http://{ip}:{PUERTO}/  (misma red Wi-Fi)")
    for e in EMPLEADOS:
        print(f"  {e['cedula']:>10}  {e['nombre']}  ({'activo' if e['activo'] else 'retirado'})")
    print("Ctrl+C para detener.", flush=True)
    try:
        Servidor(("0.0.0.0", PUERTO), Manejador).serve_forever()
    except KeyboardInterrupt:
        pass
