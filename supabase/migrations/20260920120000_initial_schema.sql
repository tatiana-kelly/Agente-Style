-- Wardrobe AI — schema inicial
-- Toda tabela de usuário nasce com RLS ativa. Não há tabela pública neste produto.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users
create table if not exists public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  name              text,
  avatar_url        text,
  height            integer check (height between 100 and 250),
  style_preferences text[] not null default '{}',
  favorite_colors   text[] not null default '{}',
  avoid_colors      text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------- wardrobe_items
create table if not exists public.wardrobe_items (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users (id) on delete cascade,
  name                 text not null,
  category             text not null check (category in ('top','bottom','dress','outerwear','shoes','accessory','bag')),
  subcategory          text not null,
  color                text not null,
  secondary_colors     text[] not null default '{}',
  pattern              text not null default 'liso',
  material             text not null default 'desconhecido',
  brand                text,
  style                text not null default 'casual',
  -- 0 = pijama, 10 = black tie. Mesma escala usada por todos os agentes.
  formality            smallint not null default 3 check (formality between 0 and 10),
  sport_type           text not null default 'nenhum',
  season               text[] not null default '{verao,outono,inverno,primavera}',
  occasions            text[] not null default '{}',
  description          text not null default '',
  image_original_url   text,
  image_processed_url  text,
  thumbnail_url        text,
  metadata             jsonb not null default '{}'::jsonb,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- O pré-filtro determinístico consulta sempre por dono + ativo, e por esporte/formalidade.
create index if not exists wardrobe_items_user_active_idx on public.wardrobe_items (user_id, active);
create index if not exists wardrobe_items_category_idx on public.wardrobe_items (user_id, category) where active;
create index if not exists wardrobe_items_sport_idx on public.wardrobe_items (user_id, sport_type) where active;
create index if not exists wardrobe_items_formality_idx on public.wardrobe_items (user_id, formality) where active;

-- ----------------------------------------------------------- user_photos
create table if not exists public.user_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  image_url   text not null,
  photo_type  text not null default 'full-body' check (photo_type in ('full-body','portrait','other')),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Uma única foto principal por usuário.
create unique index if not exists user_photos_one_primary_idx
  on public.user_photos (user_id) where is_primary;

-- --------------------------------------------------------------- outfits
create table if not exists public.outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  name        text not null,
  occasion    text,
  style       text not null,
  context     text,
  weather     jsonb,
  season      text,
  status      text not null default 'draft' check (status in ('draft','saved','discarded')),
  explanation text not null default '',
  scores      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists outfits_user_status_idx on public.outfits (user_id, status, created_at desc);

create table if not exists public.outfit_items (
  id               uuid primary key default gen_random_uuid(),
  outfit_id        uuid not null references public.outfits (id) on delete cascade,
  wardrobe_item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  role             text not null check (role in ('top','bottom','dress','shoes','outerwear','accessory','bag')),
  unique (outfit_id, wardrobe_item_id)
);

create index if not exists outfit_items_outfit_idx on public.outfit_items (outfit_id);

-- ------------------------------------------------------- generated_looks
create table if not exists public.generated_looks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  outfit_id           uuid not null references public.outfits (id) on delete cascade,
  prompt              text not null,
  image_url           text,
  model               text not null,
  generation_metadata jsonb not null default '{}'::jsonb,
  quality_score       numeric(4,3) not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists generated_looks_outfit_idx on public.generated_looks (user_id, outfit_id, created_at desc);

-- ------------------------------------------------------ user_preferences
create table if not exists public.user_preferences (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  preference_type text not null,
  value           text not null,
  weight          numeric(5,4) not null default 0 check (weight between -1 and 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- O upsert do preference-service depende desta chave.
  unique (user_id, preference_type, value)
);

-- -------------------------------------------------- observabilidade/custo
create table if not exists public.ai_usage (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  provider       text not null,
  model          text not null,
  operation      text not null,
  estimated_cost numeric(10,6) not null default 0,
  latency_ms     integer not null default 0,
  success        boolean not null default true,
  created_at     timestamptz not null default now()
);

-- O freio diário soma por usuário dentro do dia.
create index if not exists ai_usage_user_day_idx on public.ai_usage (user_id, created_at desc);

create table if not exists public.agent_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete cascade,
  agent          text not null,
  request        jsonb not null default '{}'::jsonb,
  response       jsonb not null default '{}'::jsonb,
  status         text not null default 'success' check (status in ('success','error','degraded')),
  latency_ms     integer not null default 0,
  tokens         integer not null default 0,
  estimated_cost numeric(10,6) not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists agent_runs_user_idx on public.agent_runs (user_id, created_at desc);

-- -------------------------------------------------------- updated_at auto
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

drop trigger if exists wardrobe_items_touch on public.wardrobe_items;
create trigger wardrobe_items_touch before update on public.wardrobe_items
  for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- --------------------------------- cria a linha em public.users no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
