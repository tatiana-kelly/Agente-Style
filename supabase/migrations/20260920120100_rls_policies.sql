-- Wardrobe AI — Row Level Security
-- Regra única do produto: cada pessoa só enxerga a própria linha.
-- Foto de corpo e guarda-roupa são dados sensíveis; nada aqui é público (PRP §42).

alter table public.users            enable row level security;
alter table public.wardrobe_items   enable row level security;
alter table public.user_photos      enable row level security;
alter table public.outfits          enable row level security;
alter table public.outfit_items     enable row level security;
alter table public.generated_looks  enable row level security;
alter table public.user_preferences enable row level security;
alter table public.ai_usage         enable row level security;
alter table public.agent_runs       enable row level security;

-- ------------------------------------------------------------------ users
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (auth.uid() = id);

-- Tabelas cujo dono é a coluna user_id: mesma política para todas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'wardrobe_items', 'user_photos', 'outfits',
    'generated_looks', 'user_preferences', 'ai_usage', 'agent_runs'
  ]
  loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format(
      'create policy %I_owner_all on public.%I for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t, t);
  end loop;
end
$$;

-- ----------------------------------------------------------- outfit_items
-- Não tem user_id: a posse é herdada do outfit.
drop policy if exists outfit_items_owner_all on public.outfit_items;
create policy outfit_items_owner_all on public.outfit_items
  for all
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_items.outfit_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_items.outfit_id and o.user_id = auth.uid()
    )
  );
