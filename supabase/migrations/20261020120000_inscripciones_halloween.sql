-- Obsequios de Halloween – Combuses
-- Tablas, permisos y funciones de inscripción.
--
-- Requiere la tabla public.employees (empleados de Combuses), que ya existe en el proyecto y no se modifica.
--
-- Seguridad:
--   * El público (rol anon) NO puede leer ni escribir las tablas. Solo puede llamar a:
--       - public.buscar_empleado(cedula): devuelve nombre y cargo de un empleado ACTIVO, nada más.
--       - public.inscribir(...): valida todo en el servidor y guarda la inscripción completa o nada.
--     Ambas tienen límite de consultas por conexión para que nadie pueda sacar la lista de empleados probando cédulas.
--   * Solo las personas registradas en public.administradores pueden ver y eliminar inscripciones.
--
-- Se puede ejecutar más de una vez sin perder datos.

-- 1. Tablas ----------------------------------------------------------------

create table if not exists public.acudientes (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid,  -- public.employees.id (sin llave foránea, para no afectar las otras apps que usan employees)
  nombre          text not null check (btrim(nombre) <> ''),  -- nombre oficial tomado de employees
  cargo           text,
  cedula          text not null check (cedula ~ '^[0-9]{6,10}$'),
  celular         text not null check (celular ~ '^3[0-9]{9}$'),
  autoriza_datos  boolean not null check (autoriza_datos),  -- Ley 1581 de 2012; la fecha queda en creado_en
  creado_en       timestamptz not null default now(),
  constraint acudientes_cedula_key unique (cedula)
);

create table if not exists public.ninos (
  id                uuid primary key default gen_random_uuid(),
  acudiente_id      uuid not null references public.acudientes(id) on delete cascade,
  orden             smallint not null,  -- posición en el formulario (1, 2, 3…)
  nombres           text not null check (char_length(nombres) between 5 and 80),
  edad              smallint not null check (edad between 0 and 10),  -- años cumplidos, según el acudiente
  sexo              text not null check (sexo in ('Niño', 'Niña')),
  parentesco        text not null check (parentesco in ('Hijo(a)', 'Nieto(a)', 'Sobrino(a)', 'Hermano(a)', 'Otro')),
  creado_en         timestamptz not null default now()
);
-- Si se ejecutó una versión anterior que pedía fecha de nacimiento y documento, se quitan esas columnas
alter table public.ninos
  drop column if exists fecha_nacimiento,
  drop column if exists tipo_documento,
  drop column if exists numero_documento;
create index if not exists ninos_acudiente_id_idx on public.ninos (acudiente_id);

-- Personas del equipo con acceso al panel (admin.html)
create table if not exists public.administradores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  creado_en  timestamptz not null default now()
);

-- Registro de consultas públicas por conexión, para el límite de consultas (se limpia solo)
create table if not exists public.consultas_publicas (
  id         bigint generated always as identity primary key,
  ip         text not null,
  creado_en  timestamptz not null default now()
);
create index if not exists consultas_publicas_ip_idx on public.consultas_publicas (ip, creado_en);

-- 2. Permisos ----------------------------------------------------------------

alter table public.acudientes enable row level security;
alter table public.ninos enable row level security;
alter table public.administradores enable row level security;
alter table public.consultas_publicas enable row level security;

revoke all on public.acudientes, public.ninos, public.administradores, public.consultas_publicas from anon, authenticated;
grant select, delete on public.acudientes, public.ninos to authenticated;
grant select on public.administradores to authenticated;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

drop policy if exists "admins leen acudientes" on public.acudientes;
create policy "admins leen acudientes" on public.acudientes
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "admins eliminan acudientes" on public.acudientes;
create policy "admins eliminan acudientes" on public.acudientes
  for delete to authenticated using ((select public.es_admin()));

drop policy if exists "admins leen ninos" on public.ninos;
create policy "admins leen ninos" on public.ninos
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "admins eliminan ninos" on public.ninos;
create policy "admins eliminan ninos" on public.ninos
  for delete to authenticated using ((select public.es_admin()));

drop policy if exists "cada admin ve su registro" on public.administradores;
create policy "cada admin ve su registro" on public.administradores
  for select to authenticated using (user_id = (select auth.uid()));

-- 3. Funciones internas (el público no las puede llamar) ---------------------------

-- Plazo de inscripción: debe coincidir con js/config.js
create or replace function public.inscripciones_abiertas()
returns boolean
language sql
stable
set search_path = ''
as $$
  select now() between '2026-10-19 00:00:00-05'::timestamptz and '2026-10-23 23:59:59-05'::timestamptz;
$$;
revoke execute on function public.inscripciones_abiertas() from public, anon, authenticated;

-- Máximo 40 consultas por conexión cada 10 minutos. La IP la pone el proxy de Supabase en los encabezados.
create or replace function public.consulta_permitida()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_maximo   constant int := 40;
  v_headers  jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_ip       text := nullif(btrim(coalesce(v_headers->>'cf-connecting-ip', split_part(v_headers->>'x-forwarded-for', ',', 1))), '');
begin
  if v_ip is null then
    return true;
  end if;
  delete from public.consultas_publicas where creado_en < now() - interval '1 hour';
  if (select count(*) from public.consultas_publicas where ip = v_ip and creado_en > now() - interval '10 minutes') >= c_maximo then
    return false;
  end if;
  insert into public.consultas_publicas (ip) values (v_ip);
  return true;
end;
$$;
revoke execute on function public.consulta_permitida() from public, anon, authenticated;

-- Empleado ACTIVO con esa cédula (la cédula de employees se compara solo por sus dígitos)
create or replace function public.empleado_activo(p_cedula text)
returns table (id uuid, nombre text, cargo text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, btrim(e.nombre), nullif(btrim(e.cargo), '')
  from public.employees e
  where e.activo and regexp_replace(e.cedula, '[^0-9]', '', 'g') = p_cedula
  order by e.created_at desc
  limit 1;
$$;
revoke execute on function public.empleado_activo(text) from public, anon, authenticated;

-- 4. Funciones públicas ------------------------------------------------------------
-- Responden { ok: true, ... } o { ok: false, codigo, ... } con codigo:
--   fuera_de_plazo | demasiadas_consultas | no_es_empleado | acudiente_duplicado | datos_invalidos (con "mensaje")

-- Al escribir la cédula en el formulario: { ok: true, nombre, cargo }
create or replace function public.buscar_empleado(p_cedula text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula    text := btrim(coalesce(p_cedula, ''));
  v_empleado  record;
begin
  if not public.inscripciones_abiertas() then
    return jsonb_build_object('ok', false, 'codigo', 'fuera_de_plazo');
  end if;
  if v_cedula !~ '^[0-9]{6,10}$' then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Escribe una cédula de 6 a 10 dígitos.');
  end if;
  if not public.consulta_permitida() then
    return jsonb_build_object('ok', false, 'codigo', 'demasiadas_consultas');
  end if;

  select * into v_empleado from public.empleado_activo(v_cedula);
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'no_es_empleado');
  end if;
  if exists (select 1 from public.acudientes where cedula = v_cedula) then
    return jsonb_build_object('ok', false, 'codigo', 'acudiente_duplicado');
  end if;
  return jsonb_build_object('ok', true, 'nombre', v_empleado.nombre, 'cargo', v_empleado.cargo);
end;
$$;
revoke execute on function public.buscar_empleado(text) from public;
grant execute on function public.buscar_empleado(text) to anon, authenticated;

-- Guarda al empleado (acudiente) con sus niños. El nombre y el cargo se toman de employees.
-- Responde { ok: true, ninos: N }
create or replace function public.inscribir(p_acudiente jsonb, p_ninos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Reglas de la campaña: deben coincidir con js/config.js
  c_edad_max    constant int := 10;
  c_max_ninos   constant int := 10;
  c_parentescos constant text[] := array['Hijo(a)', 'Nieto(a)', 'Sobrino(a)', 'Hermano(a)', 'Otro'];

  v_cedula     text := btrim(coalesce(p_acudiente->>'cedula', ''));
  v_celular    text := btrim(coalesce(p_acudiente->>'celular', ''));
  v_empleado   record;
  v_nino       jsonb;
  v_n          int := 0;
  v_edad       text;
  v_nombre     text;   -- nombre en minúsculas y con espacios simples, para detectar repetidos
  v_nombres    text[] := '{}';
begin
  if not public.inscripciones_abiertas() then
    return jsonb_build_object('ok', false, 'codigo', 'fuera_de_plazo');
  end if;

  -- Empleado (acudiente)
  if v_cedula !~ '^[0-9]{6,10}$' then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Escribe una cédula de 6 a 10 dígitos.');
  end if;
  if not public.consulta_permitida() then
    return jsonb_build_object('ok', false, 'codigo', 'demasiadas_consultas');
  end if;
  select * into v_empleado from public.empleado_activo(v_cedula);
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'no_es_empleado');
  end if;
  if v_celular !~ '^3[0-9]{9}$' then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Escribe un celular de 10 dígitos que empiece por 3.');
  end if;
  if (p_acudiente->'autoriza') is distinct from 'true'::jsonb then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Se necesita la autorización para inscribir a los menores.');
  end if;
  if jsonb_typeof(p_ninos) is distinct from 'array' or jsonb_array_length(p_ninos) not between 1 and c_max_ninos then
    return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Inscribe entre 1 y ' || c_max_ninos || ' niños.');
  end if;
  if exists (select 1 from public.acudientes where cedula = v_cedula) then
    return jsonb_build_object('ok', false, 'codigo', 'acudiente_duplicado');
  end if;

  -- Niños: se validan todos antes de guardar
  for v_nino in select value from jsonb_array_elements(p_ninos) loop
    v_n := v_n + 1;
    if jsonb_typeof(v_nino) is distinct from 'object' or char_length(btrim(coalesce(v_nino->>'nombres', ''))) not between 5 and 80 then
      return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Niño o niña ' || v_n || ': escribe nombres y apellidos.');
    end if;

    v_nombre := lower(regexp_replace(btrim(v_nino->>'nombres'), '\s+', ' ', 'g'));
    if v_nombre = any(v_nombres) then
      return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Niño o niña ' || v_n || ': está repetido en esta inscripción.');
    end if;
    v_nombres := v_nombres || v_nombre;

    v_edad := v_nino->>'edad';
    if coalesce(v_edad, '') !~ '^[0-9]{1,2}$' or v_edad::int > c_edad_max then
      return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Niño o niña ' || v_n || ': selecciona una edad de 0 a ' || c_edad_max || ' años.');
    end if;

    if coalesce(v_nino->>'sexo', '') not in ('Niño', 'Niña') then
      return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Niño o niña ' || v_n || ': selecciona para quién es el obsequio.');
    end if;

    if not (coalesce(v_nino->>'parentesco', '') = any(c_parentescos)) then
      return jsonb_build_object('ok', false, 'codigo', 'datos_invalidos', 'mensaje', 'Niño o niña ' || v_n || ': selecciona el parentesco.');
    end if;
  end loop;

  -- Guardar empleado y niños juntos
  begin
    with nuevo as (
      insert into public.acudientes (empleado_id, nombre, cargo, cedula, celular, autoriza_datos)
      values (v_empleado.id, v_empleado.nombre, v_empleado.cargo, v_cedula, v_celular, true)
      returning id
    )
    insert into public.ninos (acudiente_id, orden, nombres, edad, sexo, parentesco)
    select nuevo.id,
           e.orden,
           btrim(e.valor->>'nombres'),
           (e.valor->>'edad')::smallint,
           e.valor->>'sexo',
           e.valor->>'parentesco'
    from nuevo, jsonb_array_elements(p_ninos) with ordinality as e(valor, orden);
  exception when unique_violation then
    -- La misma cédula se inscribió al mismo tiempo desde otro celular
    return jsonb_build_object('ok', false, 'codigo', 'acudiente_duplicado');
  end;

  return jsonb_build_object('ok', true, 'ninos', v_n);
end;
$$;
revoke execute on function public.inscribir(jsonb, jsonb) from public;
grant execute on function public.inscribir(jsonb, jsonb) to anon, authenticated;

-- Tiempo real para el panel: Supabase avisa los cambios de acudientes (solo a quien puede leerlos: administradores)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acudientes') then
    alter publication supabase_realtime add table public.acudientes;
  end if;
end $$;

-- Que la API de Supabase vea las tablas y funciones nuevas sin esperar
notify pgrst, 'reload schema';

-- 5. Dar acceso al panel a una persona del equipo ---------------------------------
-- a) Supabase > Authentication > Users > Add user > Create new user (correo + contraseña, "Auto Confirm User").
-- b) Ejecuta en el SQL Editor, cambiando el correo:
--      insert into public.administradores (user_id, email)
--      select id, email from auth.users where email = 'persona@combuses.com'
--      on conflict (user_id) do nothing;

-- Comprobación: cuántos empleados activos pueden consultar las funciones (si sale 0, avisa)
select count(*) as empleados_activos_visibles from public.employees where activo;
