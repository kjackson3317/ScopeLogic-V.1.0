-- Keep draft / non-released SLR and child record numbers stable once assigned.
--
-- The legacy browser workspace normalizes arrays by position before cloud save.
-- That can compact gaps after deletes/reordering and send different draft
-- display numbers back during an upsert. The database is the canonical identity
-- boundary: once an existing SLR/RFI/RBB/checklist child has a number, ordinary
-- edits must not silently resequence it. Released/locked records were already
-- protected; this extends stability to non-released records as requested.

create or replace function private.preserve_child_number(
  p_old_items jsonb,
  p_new_items jsonb,
  p_number_field text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_new_items) <> 'array' then
    return coalesce(p_new_items, '[]'::jsonb);
  end if;

  for v_new in select value from jsonb_array_elements(p_new_items)
  loop
    v_old := null;
    if nullif(v_new->>'uid', '') is not null and jsonb_typeof(p_old_items) = 'array' then
      select value into v_old
      from jsonb_array_elements(p_old_items)
      where value->>'uid' = v_new->>'uid'
      limit 1;
    end if;

    if v_old is not null and nullif(v_old->>p_number_field, '') is not null then
      v_new := jsonb_set(v_new, array[p_number_field], to_jsonb(v_old->>p_number_field), true);
    end if;

    v_result := v_result || jsonb_build_array(v_new);
  end loop;

  return v_result;
end;
$$;

create or replace function private.preserve_rbb_numbers(
  p_old_items jsonb,
  p_new_items jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_sections jsonb;
  v_old_sections jsonb;
  v_system text;
  v_new_section jsonb;
  v_old_section jsonb;
  v_result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_new_items) <> 'array' then
    return coalesce(p_new_items, '[]'::jsonb);
  end if;

  for v_new in select value from jsonb_array_elements(p_new_items)
  loop
    v_old := null;
    if nullif(v_new->>'uid', '') is not null and jsonb_typeof(p_old_items) = 'array' then
      select value into v_old
      from jsonb_array_elements(p_old_items)
      where value->>'uid' = v_new->>'uid'
      limit 1;
    end if;

    if v_old is not null then
      if coalesce((v_old->>'baseSequence')::integer, 0) > 0 then
        v_new := jsonb_set(v_new, '{baseSequence}', to_jsonb((v_old->>'baseSequence')::integer), true);
      end if;
      if nullif(v_old->>'baseNumber', '') is not null then
        v_new := jsonb_set(v_new, '{baseNumber}', to_jsonb(v_old->>'baseNumber'), true);
      end if;

      v_sections := coalesce(v_new->'sections', '{}'::jsonb);
      v_old_sections := coalesce(v_old->'sections', '{}'::jsonb);
      if jsonb_typeof(v_sections) = 'object' then
        for v_system, v_new_section in select key, value from jsonb_each(v_sections)
        loop
          v_old_section := v_old_sections->v_system;
          if v_old_section is not null then
            if nullif(v_old_section->>'suffix', '') is not null then
              v_new_section := jsonb_set(v_new_section, '{suffix}', to_jsonb(v_old_section->>'suffix'), true);
            elsif v_old_section ? 'suffix' then
              v_new_section := jsonb_set(v_new_section, '{suffix}', '""'::jsonb, true);
            end if;
            if nullif(v_old_section->>'displayNumber', '') is not null then
              v_new_section := jsonb_set(v_new_section, '{displayNumber}', to_jsonb(v_old_section->>'displayNumber'), true);
            end if;
            v_sections := jsonb_set(v_sections, array[v_system], v_new_section, true);
          end if;
        end loop;
        v_new := jsonb_set(v_new, '{sections}', v_sections, true);
      end if;
    end if;

    v_result := v_result || jsonb_build_array(v_new);
  end loop;

  return v_result;
end;
$$;

create or replace function private.preserve_existing_slr_numbers()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Existing SLR identity is stable regardless of draft/released status.
  new.sequence_number := old.sequence_number;
  new.display_number := old.display_number;

  new.rfi_children := private.preserve_child_number(
    coalesce(old.rfi_children, '[]'::jsonb),
    coalesce(new.rfi_children, '[]'::jsonb),
    'number'
  );

  new.contractor_checklist_children := private.preserve_child_number(
    coalesce(old.contractor_checklist_children, '[]'::jsonb),
    coalesce(new.contractor_checklist_children, '[]'::jsonb),
    'number'
  );

  new.recommend_base_bid_children := private.preserve_rbb_numbers(
    coalesce(old.recommend_base_bid_children, '[]'::jsonb),
    coalesce(new.recommend_base_bid_children, '[]'::jsonb)
  );

  return new;
end;
$$;

drop trigger if exists slr_entries_preserve_existing_numbers on public.slr_entries;

create trigger slr_entries_preserve_existing_numbers
before update of sequence_number, display_number, rfi_children, recommend_base_bid_children, contractor_checklist_children
on public.slr_entries
for each row
execute function private.preserve_existing_slr_numbers();
