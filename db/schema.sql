-- ============================================================
--  Emily's — Base de datos de cupones (Fase 2)
--  Pegá TODO esto en Supabase: proyecto → SQL Editor → New query → Run.
-- ============================================================

-- 1) Cupones
create table if not exists coupons (
  id             bigint generated always as identity primary key,
  code           text unique not null,
  discount_type  text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric not null check (discount_value > 0),
  origin         text not null,                         -- obligatorio: TARJETA-PEYA, INSTAGRAM, etc.
  expires_at     date,                                  -- null = sin vencimiento
  max_uses       integer,                               -- null = usos ilimitados
  max_per_phone  integer not null default 1,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 2) Canjes (un registro por uso)
create table if not exists redemptions (
  id          bigint generated always as identity primary key,
  coupon_id   bigint not null references coupons(id) on delete cascade,
  phone       text not null,
  ip          text,
  redeemed_at timestamptz not null default now()
);
create index if not exists redemptions_coupon_phone on redemptions(coupon_id, phone);

-- 3) Intentos (para el límite anti-fuerza-bruta)
create table if not exists coupon_attempts (
  id           bigint generated always as identity primary key,
  ip           text,
  attempted_at timestamptz not null default now()
);
create index if not exists coupon_attempts_ip_time on coupon_attempts(ip, attempted_at);

-- 4) Seguridad: nadie accede a estas tablas salvo el servidor (service_role)
alter table coupons        enable row level security;
alter table redemptions    enable row level security;
alter table coupon_attempts enable row level security;

-- 5) Canje atómico: valida (existe, activo, no vencido, no agotado, no usado por
--    ese teléfono) + registra el uso, todo en una sola operación segura.
create or replace function redeem_coupon(p_code text, p_phone text, p_ip text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_coupon coupons;
  v_total_uses integer;
  v_phone_uses integer;
  v_recent integer;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_code  text := upper(trim(coalesce(p_code, '')));
begin
  -- Límite: 10 intentos por IP por minuto
  select count(*) into v_recent
  from coupon_attempts
  where ip = p_ip and attempted_at > now() - interval '1 minute';
  if v_recent >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate');
  end if;
  insert into coupon_attempts(ip) values (p_ip);

  if length(v_phone) < 6 then
    return jsonb_build_object('ok', false, 'error', 'phone');
  end if;

  select * into v_coupon from coupons where code = v_code;

  -- Respuesta genérica para inexistente / inactivo / vencido / agotado (no da pistas)
  if not found
     or v_coupon.active = false
     or (v_coupon.expires_at is not null and v_coupon.expires_at < current_date) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select count(*) into v_total_uses from redemptions where coupon_id = v_coupon.id;
  if v_coupon.max_uses is not null and v_total_uses >= v_coupon.max_uses then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select count(*) into v_phone_uses
  from redemptions where coupon_id = v_coupon.id and phone = v_phone;
  if v_phone_uses >= v_coupon.max_per_phone then
    return jsonb_build_object('ok', false, 'error', 'used');
  end if;

  insert into redemptions(coupon_id, phone, ip) values (v_coupon.id, v_phone, p_ip);

  return jsonb_build_object(
    'ok', true,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'origin', v_coupon.origin
  );
end;
$$;

-- Solo el servidor puede ejecutar el canje (no el navegador)
revoke execute on function redeem_coupon(text, text, text) from public, anon, authenticated;
grant  execute on function redeem_coupon(text, text, text) to service_role;

-- 6) Cupón de ejemplo para probar (15% off, primera compra)
insert into coupons (code, discount_type, discount_value, origin, expires_at, max_uses, max_per_phone, active)
values ('BIENVENIDO', 'percent', 15, 'PRIMERA-COMPRA', null, 100, 1, true)
on conflict (code) do nothing;
