# Obsequios de Halloween – Combuses

Formulario web para inscribir a niños y niñas de 0 a 10 años al obsequio de Halloween de Combuses. El empleado escribe su cédula, la página trae su nombre y cargo de la tabla `employees` (solo empleados activos), y el empleado inscribe a todos los niños a su cargo en una sola inscripción. La inscripción se guarda en Supabase. El equipo consulta, descarga en CSV y elimina inscripciones desde un panel con usuario y contraseña, y el día de la entrega lo usa como checklist para marcar quién asistió.

- `index.html`: formulario público, en tres pasos: 1) cédula y celular, 2) todos los niños, 3) confirmar que están todos. Solo puede buscar su propio nombre y cargo por cédula e inscribir; no ve datos de nadie más.
- `admin.html`: panel del equipo y checklist de la entrega. Solo entran las personas registradas como administradoras.

HTML, CSS y JavaScript sin frameworks ni paso de compilación. La librería de Supabase se carga desde jsDelivr.

## Configurar Supabase (una sola vez)

1. **Crear las tablas.** En Supabase > SQL Editor > New query, pega todo el contenido de `supabase/migrations/20261020120000_inscripciones_halloween.sql` y ejecútalo (Run). Se puede volver a ejecutar sin perder datos. Al final muestra `empleados_activos_visibles`: debe ser mayor que 0; si sale 0, las funciones no están viendo la tabla `employees`.

   **Con este paso el formulario ya funciona para todo el personal, sin usuario ni contraseña:** cada empleado solo escribe su cédula. Los pasos 2 a 4 son solo para el panel del equipo (listado y checklist de la entrega); si no lo van a usar, las inscripciones también se ven y se descargan en Supabase > Table Editor (tablas `acudientes` y `ninos`).

   **Asistencia a la entrega:** ejecuta también `supabase/migrations/20261020160000_asistencia_entrega.sql`, de la misma forma (consulta nueva, pegar, Run). Agrega a cada niño la asistencia (asistió, no asistió o pendiente) y la función para marcarla. Se puede volver a ejecutar sin perder datos.

   **Apagar el formulario:** se cierra solo al terminar el plazo. Para apagarlo antes, ejecuta `supabase/desactivar-formulario.sql`; para encenderlo otra vez, `supabase/activar-formulario.sql`. Los datos guardados no se borran.
2. **Crear la cuenta de cada persona del equipo.** Authentication > Users > Add user > Create new user: correo, contraseña y "Auto Confirm User". Puede ser una cuenta por persona o una sola para todo el equipo de la entrega, que se puede abrir en varios celulares a la vez; el correo no tiene que existir.
3. **Darle acceso al panel.** En el SQL Editor, cambiando el correo:

   ```sql
   insert into public.administradores (user_id, email)
   select id, email from auth.users where email = 'persona@combuses.com'
   on conflict (user_id) do nothing;
   ```

   Para quitarle el acceso: `delete from public.administradores where email = 'persona@combuses.com';`
4. **Recomendado:** en Authentication > Sign In / Providers, desactiva "Allow new users to sign up", para que nadie pueda crearse una cuenta por su cuenta. Aunque alguien lo hiciera, no vería nada sin estar en `administradores`.

La URL del proyecto y la clave pública (`sb_publishable_…`) están en `js/config.js`. **Nunca pongas ahí la clave secreta** (`service_role` o `sb_secret_…`).

### Cómo se protegen los datos

- El público (rol `anon`) no tiene permiso para leer, modificar ni borrar las tablas. Solo puede llamar a dos funciones:
  - `buscar_empleado(cedula)`: devuelve **solo nombre y cargo** de un empleado **activo**. Nunca salario, teléfono ni ningún otro dato de `employees`.
  - `inscribir(...)`: vuelve a validar en el servidor el plazo, que la cédula sea de un empleado activo, la edad (0 a 10 años), el parentesco, que no se repita un niño en la misma inscripción y que el empleado no se haya inscrito antes, y guarda al empleado con sus niños juntos o no guarda nada. El nombre y el cargo se toman de `employees`, no de lo que envíe el navegador.
- Las dos funciones admiten máximo 40 consultas por conexión cada 10 minutos (tabla `consultas_publicas`), para que nadie pueda sacar la lista de empleados probando cédulas. Solo responden dentro del plazo de inscripción.
- La tabla `employees` no se modifica: las inscripciones guardan `empleado_id` sin llave foránea, para no afectar a las otras aplicaciones que la usan.
- Con la seguridad por filas (RLS) de Supabase, solo quien está en `administradores` puede ver y eliminar. Al eliminar un acudiente se eliminan sus niños.
- La cédula del empleado es única: cada empleado se inscribe una sola vez, con todos sus niños. No se piden documentos ni fecha de nacimiento de los niños, así que si dos empleados inscriben al mismo niño (por ejemplo, papá y mamá) el sistema no lo detecta: revisa los nombres repetidos en el CSV.

## Cómo abrirla

La aplicación usa módulos de JavaScript (`import`/`export`), y el navegador no los carga si se abre `index.html` con doble clic. Hay que servirla desde un servidor. Dentro de esta carpeta ejecuta:

```
python servidor-local.py
```

y abre <http://127.0.0.1:8090/> (formulario) o <http://127.0.0.1:8090/admin.html> (panel). En la consola aparece también la dirección para abrirla desde el celular en la misma red Wi-Fi.

- Sirve todo sin caché: cada cambio en el código se ve con solo recargar la página.
- No uses `python -m http.server`: en Windows rechaza conexiones cuando el navegador pide todos los módulos a la vez, y la página queda a veces sin funcionar.
- Usa `127.0.0.1` y no `localhost`. Si otra app instalable se abrió antes en `localhost` con el mismo puerto, su service worker puede seguir mostrando esa otra app.

## Publicación (GitHub Pages)

La app está publicada con GitHub Pages desde la rama `main` del repositorio `DesarrolloCombuses/obsequios-halloween`:

- Formulario para el personal: <https://desarrollocombuses.github.io/obsequios-halloween/>
- Panel del equipo: <https://desarrollocombuses.github.io/obsequios-halloween/admin.html>

Para publicar un cambio: cambia `VERSION` en `sw.js`, haz commit y `git push`. GitHub Pages lo publica en uno o dos minutos y las apps abiertas o instaladas se actualizan solas.

`_config.yml` deja fuera del sitio publicado lo que no es de la app (`demo/`, `supabase/`, `servidor-local.py` y este README); siguen en el repositorio.

## Probar sin Supabase (modo de prueba)

Para probar todo antes de correr el SQL, dentro de esta carpeta ejecuta:

```
python demo/servidor-demo.py
```

y abre <http://127.0.0.1:8091/> (formulario) y <http://127.0.0.1:8091/admin.html> (panel), mejor en dos ventanas una al lado de la otra.

- Es la app real; solo cambia la conexión: en vez de Supabase, el servidor de prueba responde lo mismo que las funciones del SQL (empleado activo, edades, duplicados, plazo) con empleados ficticios.
- Arriba aparece un aviso "Prueba" con las cédulas de prueba; al tocar una se escribe en el formulario. Hay tres empleados activos (uno sin cargo) y uno retirado, que debe ser rechazado.
- Panel: `admin@combuses.test`, contraseña `halloween` (el aviso tiene un botón que los llena).
- El panel se actualiza solo al inscribir o eliminar, también desde otro celular o computador en la misma red Wi-Fi (la dirección sale en la consola).
- Los datos viven en la memoria del servidor de prueba: se borran al cerrarlo (Ctrl+C). Nunca toca Supabase.
- Lo único que no simula es el límite de 40 consultas cada 10 minutos.
- Usa el puerto 8091 para no mezclar la caché ni la sesión con la app real del 8090.

## App instalable (PWA) y versiones

- Se puede instalar en el celular o el computador como una app. En Android, Chrome o Edge aparece el botón "Instalar app" en el pie de página. En iPhone: Compartir > Agregar a inicio. El formulario y el panel se instalan como apps distintas.
- La versión se ve en el pie de página (por ejemplo `v1.0.0`). Al tocarla se busca una actualización en ese momento.
- **Para publicar una versión nueva:** sube los archivos cambiados y cambia `VERSION` en `sw.js` (por ejemplo a `"1.0.1"`). Las apps abiertas la detectan en máximo 5 minutos, o al volver a la app, y se recargan solas. Si alguien está llenando el formulario, en vez de recargar le aparece un aviso con el botón "Actualizar", para no borrarle lo escrito.
- El service worker (`sw.js`) pide siempre a la red la última versión de los archivos de la app y usa la caché solo si no hay conexión. Lo que viene de Supabase nunca se guarda en caché.
- El modo app solo funciona con HTTPS o en `127.0.0.1`/`localhost`. Abriéndola por la IP de la red (`http://192.168.…`) funciona como página normal, sin instalación ni actualización automática.

## Inscripción en tres pasos

1. **Tu cédula:** el empleado escribe su cédula y su celular; la página trae su nombre y cargo. Desde aquí se le avisa que tenga a mano los datos de todos sus niños.
2. **Tus niños:** agrega a todos sus niños de 0 a 10 años, con un aviso de que es una sola inscripción y que después no podrá agregar más.
3. **Confirmar:** ve la lista completa y confirma "Sí, están todos" o vuelve a agregar. Al enviar aparece "¡Inscripción completa!".

El servidor no deja inscribir dos veces la misma cédula: si el empleado vuelve, el paso 1 le dice que ya tiene una inscripción.

## Entrega de obsequios (checklist)

El día de la entrega, el equipo entra a `admin.html` (en el celular o el computador) y usa el listado como checklist:

- En cada niño o niña hay dos botones: **Asistió** (verde) y **No asistió** (rojo). Tocar otra vez el marcado lo deja pendiente, por si hubo un error.
- **Todos asistieron**, debajo del nombre del empleado, marca de una vez a todos sus niños.
- Los contadores de arriba (Inscritos, Pendientes, Asistieron, No asistieron) también filtran el listado. Por ejemplo, "Pendientes" deja solo a quienes faltan.
- El buscador encuentra por cédula del empleado o por nombre del empleado o del niño, sin importar tildes ni mayúsculas.
- Cada marca guarda la hora y el correo de quien la hizo. Se ve debajo de los botones y sale en el CSV (columnas Asistencia, Asistencia marcada y Marcada por).
- Se pueden usar varios celulares a la vez: lo que marca uno aparece en los demás en un par de segundos.

Solo los administradores pueden marcar (función `marcar_asistencia`); ni el público ni los administradores pueden cambiar la tabla directamente.

## Panel en tiempo real

Con la sesión abierta, el panel muestra "En vivo" y el listado se actualiza solo cada vez que alguien se inscribe, se elimina una inscripción o se marca una asistencia. Usa Supabase Realtime sobre las tablas `acudientes` y `ninos` (los SQL las agregan a la publicación `supabase_realtime`), y solo reciben los cambios quienes tienen permiso de leerlos: los administradores.

## Estructura

```
index.html                  Formulario público y plantilla de la tarjeta de niño
admin.html                  Panel del equipo: inicio de sesión y listado
sw.js                       Service worker: VERSION de la app, caché y actualización automática
manifest.webmanifest        Datos de la app instalable del formulario (nombre, íconos, colores)
manifest-admin.webmanifest  Datos de la app instalable del panel
servidor-local.py           Servidor de desarrollo sin caché (no se publica)
demo/                       Modo de prueba sin Supabase (no se publica)
  servidor-demo.py            Servidor que imita las funciones del SQL con empleados ficticios
  supabase-demo.js            Reemplaza a js/servicios/supabase.js en el modo de prueba
supabase/migrations/        Tablas, permisos y funciones (SQL), en orden: inscripciones y luego asistencia
assets/iconos/              Íconos de la app (Android, iPhone y adaptable)
assets/img/
  marca/
    logo-halloween.webp         Logo de Halloween de Combuses sin fondo: en el formulario, bajo el título y junto al plazo (1000 px)
    logo-halloween-640.webp     El mismo, para celulares (640 px)
    logo-halloween.png          El mismo en PNG, para navegadores viejos que no leen WebP
    combuses-logo-negativo.png  Logo para fondos oscuros (azul -> blanco); es el que usa la barra del panel
    combuses-logo.png           Logo con los colores originales y fondo transparente, para fondos claros
  calabaza.svg              Calabaza iluminada del panel (también es el ícono de la pestaña)
  murcielago.svg            Murciélago que cruza el fondo
css/
  tokens.css                Colores, tipografías y efectos del tema "noche de Halloween"
  base.css                  Reinicio, tipografía, controles, botones y mensajes
  ambiente.css              Fondo decorativo: cielo, estrellas, luna, murciélagos y neblina
  hero.css                  Encabezado
  formulario.css            Formulario y tarjetas de niños
  listado.css               Tabla de inscritos (tarjetas en celular)
  admin.css                 Inicio de sesión y barra de sesión del panel
js/
  main.js                   Punto de entrada del formulario público
  admin.js                  Punto de entrada del panel
  pwa.js                    Registra el service worker, muestra la versión, se actualiza sola e "Instalar app"
  config.js                 Plazo, edades, límites y conexión a Supabase
  validacion.js             Reglas y mensajes de error (funciones puras, sin DOM)
  utilidades/
    dom.js                  Atajos del DOM, errores de campo y botones en espera
    fechas.js               Edad, fecha de hoy en Colombia y formatos
  servicios/
    supabase.js             Cliente de Supabase (se carga solo cuando se necesita)
    inscripciones.js        Inscribir, listar, marcar asistencia y eliminar
    sesion.js               Inicio y cierre de sesión, y si el usuario es administrador
    exportacion.js          Generación y descarga del CSV
  componentes/
    formulario.js           Los tres pasos: validación, confirmación, envío y errores del servidor
    pasos.js                Muestra un paso a la vez y marca el avance arriba
    empleado.js             Busca al empleado al escribir la cédula y muestra nombre y cargo
    ninos.js                Tarjetas de niños: agregar, quitar y opciones de edad
    plazo.js                Abre o cierra el formulario según la fecha
    acceso.js               Formulario de inicio de sesión del panel
    listado.js              Checklist de la entrega: asistencia, filtros, buscador, tiempo real, eliminar y exportar
    mensajes.js             Aviso de éxito o error
```

## Dónde cambiar cada cosa

| Quiero cambiar…                                  | Archivo              |
| ------------------------------------------------ | -------------------- |
| Fechas del plazo, edad máxima, máximo de niños | `js/config.js` **y** la función `inscribir` en `supabase/migrations/…sql` (y volver a ejecutar el SQL) |
| Mensajes de error y reglas de validación         | `js/validacion.js` (y las mismas reglas en el SQL) |
| Versión de la app (al publicar cambios)          | `VERSION` en `sw.js` |
| Nombre e íconos de la app instalada              | `manifest.webmanifest`, `manifest-admin.webmanifest` y `assets/iconos/` |
| Textos del formulario, campos y opciones         | `index.html`         |
| Colores y tipografías                            | `css/tokens.css`     |
| Logo de Halloween del formulario y su tamaño     | `assets/img/marca/logo-halloween*` y `.logo-halloween` en `css/hero.css` |
| Logo de la barra del panel                       | `assets/img/marca/combuses-logo-negativo.png` y `.logo` en `css/hero.css` |
| Estrellas, luna, murciélagos y neblina           | `css/ambiente.css`   |
| Columnas del CSV                                 | `js/servicios/exportacion.js` |

Si cambias la edad máxima, actualiza también el texto "de 0 a 10 años" del encabezado en `index.html` y el `check` de `edad` de la tabla `ninos` del SQL (las opciones de edad del formulario salen solas de `EDAD_MAX`). Si agregas una opción de parentesco, agrégala en `index.html` y en la lista `c_parentescos` y el `check` de la tabla `ninos` del SQL.

## Celulares (Android e iOS)

- Probada en anchos de 320 a 430 px (iPhone SE a Pro Max, Android de 360 a 412 px), tablet de 768 px y horizontal de 844 px, sin desplazamiento lateral.
- Los campos tienen letra de 16 px para que iOS no haga zoom al tocarlos.
- Hasta 640 px el listado pasa de tabla a tarjetas, y el vidrio esmerilado se cambia por un fondo casi opaco para no gastar batería ni trabar Android de gama baja (`css/tokens.css`).
- Los efectos al pasar el mouse solo se activan donde hay mouse, y en pantallas táctiles los botones miden al menos 44 px de alto.
- Se respeta la muesca del iPhone y la opción de "reducir movimiento" del sistema.

## Datos

Tablas en Supabase:

- `acudientes`: el empleado que inscribe. `empleado_id`, nombre y cargo (tomados de `employees`), cédula (única), celular, autorización de datos y fecha de inscripción.
- `ninos`: acudiente, orden en el formulario, nombres y apellidos, edad (0 a 10 años, la que elige el acudiente), obsequio para (Niño/Niña), parentesco y asistencia a la entrega (`asistio`, `no_asistio` o vacía = pendiente, con la hora y el correo de quien la marcó).
- `administradores`: personas del equipo con acceso al panel.
- `consultas_publicas`: conexiones que consultaron en la última hora, para el límite de consultas. Se limpia sola.

En el navegador, `js/servicios/inscripciones.js` convierte las filas a esta forma, que usan el listado y el CSV:

```js
{
  id, acudiente, cargo, ccAcudiente, celular, fechaInscripcion,
  ninos: [{ id, nombres, edad, sexo, parentesco, asistencia, asistenciaEn, asistenciaPor }]
}
```
