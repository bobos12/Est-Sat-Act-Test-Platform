-- =====================================================================
-- Northmark — storage buckets (Supabase Storage)
-- source-documents: private, original EST PDFs (admin only)
-- question-media:   public read, figures/graphs used inside questions
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('source-documents', 'source-documents', false, 52428800, array['application/pdf']),
  ('question-media', 'question-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "source documents: admin read"
  on storage.objects for select using (bucket_id = 'source-documents' and public.is_admin());
-- Insert only: existing objects can never be overwritten or removed through the API.
create policy "source documents: admin upload"
  on storage.objects for insert with check (bucket_id = 'source-documents' and public.is_admin());

create policy "question media: public read"
  on storage.objects for select using (bucket_id = 'question-media');
create policy "question media: admin write"
  on storage.objects for insert with check (bucket_id = 'question-media' and public.is_admin());
create policy "question media: admin update"
  on storage.objects for update using (bucket_id = 'question-media' and public.is_admin());
create policy "question media: admin delete"
  on storage.objects for delete using (bucket_id = 'question-media' and public.is_admin());
