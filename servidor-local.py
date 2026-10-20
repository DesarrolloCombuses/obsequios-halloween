"""Servidor de desarrollo: sirve la app sin caché, para ver cada cambio con solo recargar la página.

Uso (dentro de esta carpeta):
    python servidor-local.py          -> puerto 8090
    python servidor-local.py 8000     -> otro puerto

Por qué no "python -m http.server": en Windows ese servidor solo deja 5 conexiones en espera y, cuando el
navegador pide todos los módulos de JavaScript a la vez, algunas se rechazan y la página queda sin funcionar.

Escucha en toda la red local para poder abrirla desde el celular. Sin HTTPS los celulares la abren como
página normal (sin modo app ni actualización automática); el modo app funciona en 127.0.0.1 y en el hosting con HTTPS.
"""
import http.server
import os
import socket
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
RAIZ = os.path.dirname(os.path.abspath(__file__))


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
        self.send_header("Cache-Control", "no-cache")  # el navegador pregunta siempre si el archivo cambió
        super().end_headers()


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
    print(f"Formulario: http://127.0.0.1:{PUERTO}/")
    print(f"Panel:      http://127.0.0.1:{PUERTO}/admin.html")
    ip = ip_en_la_red()
    if ip:
        print(f"Celular:    http://{ip}:{PUERTO}/  (misma red Wi-Fi)")
    print("Ctrl+C para detener.")
    try:
        Servidor(("0.0.0.0", PUERTO), Manejador).serve_forever()
    except KeyboardInterrupt:
        pass
