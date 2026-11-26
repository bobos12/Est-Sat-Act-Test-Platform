-- =====================================================================
-- TargetScore — admins can delete knowledge-base documents
--
-- Deleting a question paper also deletes its answer key. Exams already
-- built from it are kept (with students' results): their questions are
-- only unlinked from the document. Reference questions that are in no
-- exam are deleted. The PDF files are removed by the app afterwards.
-- Ordinary deletes stay blocked; only this function can delete.
-- =====================================================================

create or replace function public.guard_source_document()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.allow_document_delete', true) = 'on' then
      return old;
    end if;
    raise exception 'Source documents cannot be deleted from the knowledge base' using errcode = '42501';
  end if;
  if new.storage_path <> old.storage_path or new.file_sha256 <> old.file_sha256 then
    raise exception 'Source document files are immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.admin_delete_source_document(p_doc uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.source_documents;
  ids uuid[];
  paths text[];
  kept int;
  removed int;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into d from public.source_documents where id = p_doc;
  if not found then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A paper takes its answer key(s) with it; an answer key goes alone.
  select array_agg(id), array_agg(storage_path) into ids, paths
    from public.source_documents
   where id = p_doc
      or (d.kind = 'question_paper' and kind = 'answer_key'
          and (paired_document_id = p_doc or id = d.paired_document_id));

  -- Questions used by exams stay (unlinked); reference-only questions go.
  update public.questions q set source_document_id = null
   where q.source_document_id = any(ids)
     and exists (select 1 from public.exam_questions eq where eq.question_id = q.id);
  get diagnostics kept = row_count;
  delete from public.questions where source_document_id = any(ids);
  get diagnostics removed = row_count;

  update public.stimuli s set source_document_id = null
   where s.source_document_id = any(ids)
     and exists (select 1 from public.questions q where q.stimulus_id = s.id);
  delete from public.stimuli where source_document_id = any(ids);

  update public.source_documents set paired_document_id = null where paired_document_id = any(ids);
  perform set_config('app.allow_document_delete', 'on', true);
  delete from public.source_documents where id = any(ids);
  perform set_config('app.allow_document_delete', 'off', true);

  perform public.write_audit('document.delete', 'source_document', p_doc::text,
    jsonb_build_object('title', d.title, 'documents', to_jsonb(ids), 'questions_removed', removed, 'questions_kept', kept));
  return jsonb_build_object('ids', to_jsonb(ids), 'paths', to_jsonb(paths), 'removed', removed, 'kept', kept);
end $$;

revoke execute on function public.admin_delete_source_document(uuid) from public, anon;
grant execute on function public.admin_delete_source_document(uuid) to authenticated;   -- checks is_admin() inside
