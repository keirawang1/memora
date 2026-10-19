create policy media_catalog_select_anon on public.media_catalog
  for select to anon using (true);
