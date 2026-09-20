-- Wardrobe AI — Storage
-- Todos os buckets são PRIVADOS. O acesso acontece por URL assinada gerada no servidor.
-- Convenção de caminho: <user_id>/<arquivo>. A primeira pasta é a chave de autorização.

insert into storage.buckets (id, name, public)
values
  ('user-photos',          'user-photos',          false),
  ('wardrobe-original',    'wardrobe-original',    false),
  ('wardrobe-processed',   'wardrobe-processed',   false),
  ('wardrobe-thumbnails',  'wardrobe-thumbnails',  false),
  ('generated-looks',      'generated-looks',      false)
on conflict (id) do update set public = excluded.public;

-- Uma política por operação, para cada bucket do produto.
do $$
declare
  b text;
  op text;
  policy_name text;
begin
  foreach b in array array[
    'user-photos', 'wardrobe-original', 'wardrobe-processed',
    'wardrobe-thumbnails', 'generated-looks'
  ]
  loop
    foreach op in array array['select', 'insert', 'update', 'delete']
    loop
      policy_name := format('%s_%s_own', replace(b, '-', '_'), op);
      execute format('drop policy if exists %I on storage.objects', policy_name);

      if op = 'insert' then
        execute format(
          'create policy %I on storage.objects for insert to authenticated
             with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
          policy_name, b);
      elsif op = 'update' then
        execute format(
          'create policy %I on storage.objects for update to authenticated
             using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
             with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
          policy_name, b, b);
      else
        execute format(
          'create policy %I on storage.objects for %s to authenticated
             using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
          policy_name, op, b);
      end if;
    end loop;
  end loop;
end
$$;
