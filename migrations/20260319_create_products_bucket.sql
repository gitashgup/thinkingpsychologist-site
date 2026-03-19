insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update
set public = true,
    name = excluded.name;

drop policy if exists "Public read products bucket" on storage.objects;
create policy "Public read products bucket"
on storage.objects
for select
to public
using (bucket_id = 'products');

drop policy if exists "Authenticated upload products bucket" on storage.objects;
create policy "Authenticated upload products bucket"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated update products bucket" on storage.objects;
create policy "Authenticated update products bucket"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);

drop policy if exists "Authenticated delete products bucket" on storage.objects;
create policy "Authenticated delete products bucket"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);
