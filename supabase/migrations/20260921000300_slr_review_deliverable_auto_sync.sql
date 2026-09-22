-- Keep SLR-selected deliverables synchronized with the Review Deliverables workflow.
--
-- SLR remains the source record.
-- Generated records are linked back to the originating Master Finding and SLR child.
-- Manually created deliverable/checklist records are not managed by this synchronization.

alter table public.master_project_deliverable_items
  add column if not exists source_child_uid text not null default '';

alter table public.master_project_checklist_items
  add column if not exists source_child_uid text not null default '';

create unique index if not exists master_project_deliverable_items_slr_child_uid_uq
  on public.master_project_deliverable_items
    (master_project_id, deliverable_type, related_master_finding_id, source_child_uid)
  where related_master_finding_id is not null
    and source_child_uid <> '';

create unique index if not exists master_project_checklist_items_slr_child_uid_uq
  on public.master_project_checklist_items
    (master_project_id, linked_master_finding_id, source_child_uid)
  where linked_master_finding_id is not null
    and source_child_uid <> '';


create or replace function public.sync_slr_entry_review_deliverables(
  p_slr_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s record;
  finding record;
  action_id uuid;
  check_id uuid;
  next_seq integer;
  desired_display text;
  content_text text;
  system_text text;
  child jsonb;
  rbb jsonb;
  section jsonb;
  section_key text;
  child_uid text;
  keep_rfi text[] := array[]::text[];
  keep_rbb text[] := array[]::text[];
  keep_check text[] := array[]::text[];
begin
  select se.*, p.master_project_id
    into s
  from public.slr_entries se
  join public.projects p on p.id = se.project_id
  where se.id = p_slr_entry_id;

  if not found or s.master_project_id is null then
    return;
  end if;

  if s.master_finding_id is null then
    select mf.id
      into s.master_finding_id
    from public.master_project_findings mf
    where mf.master_project_id = s.master_project_id
      and (
        mf.legacy_uid = s.legacy_uid
        or mf.display_number = s.display_number
      )
    order by
      case when mf.legacy_uid = s.legacy_uid then 0 else 1 end,
      mf.created_at
    limit 1;
  end if;

  if s.master_finding_id is null then
    return;
  end if;

  select *
    into finding
  from public.master_project_findings mf
  where mf.id = s.master_finding_id;

  if not found then
    return;
  end if;

  system_text := coalesce(
    nullif(s.system_name, ''),
    nullif(s.systems->>0, ''),
    'Other'
  );

  ----------------------------------------------------------------------
  -- CLARIFICATION LOG
  ----------------------------------------------------------------------

  if coalesce(s.include_clarification, false) then

    select di.id
      into action_id
    from public.master_project_deliverable_items di
    where di.master_project_id = s.master_project_id
      and di.related_master_finding_id = s.master_finding_id
      and di.deliverable_type = 'CL'
      and di.source_child_uid = 'slr:clarification'
    limit 1;

    content_text := coalesce(
      nullif(s.rfi_question, ''),
      nullif(s.scope_concern, ''),
      nullif(s.recommended_bid_basis, ''),
      s.scope_item
    );

    if action_id is not null then

      update public.master_project_deliverable_items
      set
        system_name = system_text,
        title = s.scope_item,
        content = content_text,
        reference = s.reference,
        updated_at = timezone('utc', now())
      where id = action_id;

    elsif not exists (
      select 1
      from public.master_project_deliverable_items di
      where di.master_project_id = s.master_project_id
        and di.related_master_finding_id = s.master_finding_id
        and di.deliverable_type = 'CL'
        and di.source_child_uid = ''
    ) then

      select coalesce(max(sequence_number), 0) + 1
        into next_seq
      from public.master_project_deliverable_items
      where master_project_id = s.master_project_id
        and deliverable_type = 'CL';

      insert into public.master_project_deliverable_items (
        owner_id,
        master_project_id,
        related_master_finding_id,
        created_by_user_id,
        deliverable_type,
        sequence_number,
        display_number,
        system_name,
        title,
        content,
        impact_considerations,
        reference,
        status,
        response,
        response_date,
        response_source,
        client_facing,
        sort_order,
        source_child_uid
      )
      values (
        s.owner_id,
        s.master_project_id,
        s.master_finding_id,
        s.owner_id,
        'CL',
        next_seq,
        'CL-' || lpad(next_seq::text, 3, '0'),
        system_text,
        s.scope_item,
        content_text,
        '',
        s.reference,
        'Draft',
        '',
        null,
        '',
        true,
        next_seq,
        'slr:clarification'
      );

    end if;

  else

    delete from public.master_project_deliverable_items
    where master_project_id = s.master_project_id
      and related_master_finding_id = s.master_finding_id
      and deliverable_type = 'CL'
      and source_child_uid = 'slr:clarification';

  end if;


  ----------------------------------------------------------------------
  -- FORMAL RFI CHILDREN
  ----------------------------------------------------------------------

  for child in
    select value
    from jsonb_array_elements(
      coalesce(s.rfi_children, '[]'::jsonb)
    )
  loop

    child_uid :=
      'rfi:' ||
      coalesce(
        nullif(child->>'uid', ''),
        md5(child::text)
      );

    if coalesce((child->>'includeInFormalRfi')::boolean, true) then

      keep_rfi := array_append(keep_rfi, child_uid);

      select di.id
        into action_id
      from public.master_project_deliverable_items di
      where di.master_project_id = s.master_project_id
        and di.related_master_finding_id = s.master_finding_id
        and di.deliverable_type = 'RFI'
        and di.source_child_uid = child_uid
      limit 1;

      system_text := coalesce(
        nullif(child->'systems'->>0, ''),
        nullif(s.system_name, ''),
        nullif(s.systems->>0, ''),
        'Other'
      );

      content_text := coalesce(
        nullif(child->>'question', ''),
        nullif(s.rfi_question, ''),
        nullif(s.scope_concern, ''),
        s.scope_item
      );

      desired_display := nullif(child->>'number', '');

      if action_id is not null then

        update public.master_project_deliverable_items
        set
          system_name = system_text,
          title = coalesce(
            nullif(child->>'title', ''),
            s.scope_item
          ),
          content = content_text,
          reference = coalesce(
            nullif(child->>'reference', ''),
            s.reference
          ),
          status = coalesce(
            nullif(child->>'status', ''),
            'Draft'
          ),
          response = coalesce(child->>'response', ''),
          response_date = nullif(child->>'responseDate', '')::date,
          response_source = coalesce(child->>'responseSource', ''),
          updated_at = timezone('utc', now())
        where id = action_id;

      elsif not exists (
        select 1
        from public.master_project_deliverable_items di
        where di.master_project_id = s.master_project_id
          and di.related_master_finding_id = s.master_finding_id
          and di.deliverable_type = 'RFI'
          and di.source_child_uid = ''
          and (
            desired_display is null
            or di.display_number = desired_display
          )
      ) then

        select coalesce(max(sequence_number), 0) + 1
          into next_seq
        from public.master_project_deliverable_items
        where master_project_id = s.master_project_id
          and deliverable_type = 'RFI';

        if desired_display is null
          or exists (
            select 1
            from public.master_project_deliverable_items
            where master_project_id = s.master_project_id
              and display_number = desired_display
          )
        then
          desired_display :=
            'RFI-' || lpad(next_seq::text, 3, '0');
        end if;

        insert into public.master_project_deliverable_items (
          owner_id,
          master_project_id,
          related_master_finding_id,
          created_by_user_id,
          deliverable_type,
          sequence_number,
          display_number,
          system_name,
          title,
          content,
          impact_considerations,
          reference,
          status,
          response,
          response_date,
          response_source,
          client_facing,
          sort_order,
          source_child_uid
        )
        values (
          s.owner_id,
          s.master_project_id,
          s.master_finding_id,
          s.owner_id,
          'RFI',
          next_seq,
          desired_display,
          system_text,
          coalesce(
            nullif(child->>'title', ''),
            s.scope_item
          ),
          content_text,
          '',
          coalesce(
            nullif(child->>'reference', ''),
            s.reference
          ),
          coalesce(
            nullif(child->>'status', ''),
            'Draft'
          ),
          coalesce(child->>'response', ''),
          nullif(child->>'responseDate', '')::date,
          coalesce(child->>'responseSource', ''),
          true,
          next_seq,
          child_uid
        );

      end if;
    end if;
  end loop;

  delete from public.master_project_deliverable_items
  where master_project_id = s.master_project_id
    and related_master_finding_id = s.master_finding_id
    and deliverable_type = 'RFI'
    and source_child_uid like 'rfi:%'
    and not (source_child_uid = any(keep_rfi));


  ----------------------------------------------------------------------
  -- RECOMMEND BASE BID CHILDREN
  ----------------------------------------------------------------------

  for rbb in
    select value
    from jsonb_array_elements(
      coalesce(s.recommend_base_bid_children, '[]'::jsonb)
    )
  loop

    for section_key, section in
      select key, value
      from jsonb_each(
        coalesce(rbb->'sections', '{}'::jsonb)
      )
    loop

      child_uid :=
        'rbb:' ||
        coalesce(
          nullif(section->>'uid', ''),
          coalesce(
            nullif(rbb->>'uid', ''),
            md5(rbb::text)
          ) || ':' || section_key
        );

      keep_rbb := array_append(keep_rbb, child_uid);

      select di.id
        into action_id
      from public.master_project_deliverable_items di
      where di.master_project_id = s.master_project_id
        and di.related_master_finding_id = s.master_finding_id
        and di.deliverable_type = 'RBB'
        and di.source_child_uid = child_uid
      limit 1;

      system_text := coalesce(
        nullif(section->>'system', ''),
        section_key,
        nullif(s.system_name, ''),
        'Other'
      );

      content_text :=
        coalesce(section->>'recommendation', '');

      desired_display :=
        nullif(section->>'displayNumber', '');

      if action_id is not null then

        update public.master_project_deliverable_items
        set
          system_name = system_text,
          title = coalesce(
            nullif(rbb->>'title', ''),
            s.scope_item
          ),
          content = content_text,
          reference = s.reference,
          status = coalesce(
            nullif(section->>'status', ''),
            'Current'
          ),
          client_facing =
            coalesce(section->>'status', 'Current') <> 'Superseded',
          updated_at = timezone('utc', now())
        where id = action_id;

      elsif not exists (
        select 1
        from public.master_project_deliverable_items di
        where di.master_project_id = s.master_project_id
          and di.related_master_finding_id = s.master_finding_id
          and di.deliverable_type = 'RBB'
          and di.source_child_uid = ''
          and (
            desired_display is null
            or di.display_number = desired_display
          )
      ) then

        select coalesce(max(sequence_number), 0) + 1
          into next_seq
        from public.master_project_deliverable_items
        where master_project_id = s.master_project_id
          and deliverable_type = 'RBB';

        if desired_display is null
          or exists (
            select 1
            from public.master_project_deliverable_items
            where master_project_id = s.master_project_id
              and display_number = desired_display
          )
        then
          desired_display :=
            'RBB-' || lpad(next_seq::text, 3, '0');
        end if;

        insert into public.master_project_deliverable_items (
          owner_id,
          master_project_id,
          related_master_finding_id,
          created_by_user_id,
          deliverable_type,
          sequence_number,
          display_number,
          system_name,
          title,
          content,
          impact_considerations,
          reference,
          status,
          response,
          response_date,
          response_source,
          client_facing,
          sort_order,
          source_child_uid
        )
        values (
          s.owner_id,
          s.master_project_id,
          s.master_finding_id,
          s.owner_id,
          'RBB',
          next_seq,
          desired_display,
          system_text,
          coalesce(
            nullif(rbb->>'title', ''),
            s.scope_item
          ),
          content_text,
          '',
          s.reference,
          coalesce(
            nullif(section->>'status', ''),
            'Current'
          ),
          '',
          null,
          '',
          coalesce(section->>'status', 'Current') <> 'Superseded',
          next_seq,
          child_uid
        );

      end if;
    end loop;
  end loop;

  delete from public.master_project_deliverable_items
  where master_project_id = s.master_project_id
    and related_master_finding_id = s.master_finding_id
    and deliverable_type = 'RBB'
    and source_child_uid like 'rbb:%'
    and not (source_child_uid = any(keep_rbb));


  ----------------------------------------------------------------------
  -- CONTRACTOR CHECKLIST CHILDREN
  ----------------------------------------------------------------------

  for child in
    select value
    from jsonb_array_elements(
      coalesce(s.contractor_checklist_children, '[]'::jsonb)
    )
  loop

    child_uid :=
      'checklist:' ||
      coalesce(
        nullif(child->>'uid', ''),
        md5(child::text)
      );

    keep_check := array_append(keep_check, child_uid);

    select ci.id
      into check_id
    from public.master_project_checklist_items ci
    where ci.master_project_id = s.master_project_id
      and ci.linked_master_finding_id = s.master_finding_id
      and ci.source_child_uid = child_uid
    limit 1;

    system_text := coalesce(
      nullif(child->>'system', ''),
      nullif(s.system_name, ''),
      nullif(s.systems->>0, ''),
      'General'
    );

    content_text := coalesce(
      nullif(child->>'question', ''),
      nullif(s.checklist_scope_item, ''),
      s.scope_item
    );

    if check_id is not null then

      update public.master_project_checklist_items
      set
        system_name = system_text,
        question = content_text,
        status = coalesce(
          nullif(child->>'status', ''),
          'Open'
        ),
        response = coalesce(child->>'response', ''),
        response_reason = coalesce(
          child->>'responseReason',
          ''
        ),
        updated_at = timezone('utc', now())
      where id = check_id;

    elsif not exists (
      select 1
      from public.master_project_checklist_items ci
      where ci.master_project_id = s.master_project_id
        and ci.linked_master_finding_id = s.master_finding_id
        and ci.source_child_uid = ''
        and ci.question = content_text
    ) then

      select coalesce(max(sequence_number), 0) + 1
        into next_seq
      from public.master_project_checklist_items
      where master_project_id = s.master_project_id;

      insert into public.master_project_checklist_items (
        owner_id,
        master_project_id,
        created_by_user_id,
        linked_master_finding_id,
        sequence_number,
        display_number,
        sort_order,
        category,
        system_name,
        question,
        status,
        response,
        response_reason,
        source_child_uid
      )
      values (
        s.owner_id,
        s.master_project_id,
        s.owner_id,
        s.master_finding_id,
        next_seq,
        'CSC-' || lpad(next_seq::text, 3, '0'),
        next_seq,
        'Project-Specific',
        system_text,
        content_text,
        coalesce(
          nullif(child->>'status', ''),
          'Open'
        ),
        coalesce(child->>'response', ''),
        coalesce(child->>'responseReason', ''),
        child_uid
      );

    end if;
  end loop;

  delete from public.master_project_checklist_items
  where master_project_id = s.master_project_id
    and linked_master_finding_id = s.master_finding_id
    and source_child_uid like 'checklist:%'
    and not (source_child_uid = any(keep_check));

end;
$function$;


create or replace function public.sync_slr_entry_review_deliverables_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.sync_slr_entry_review_deliverables(new.id);

  return new;
end;
$function$;


drop trigger if exists zz_slr_entries_sync_review_deliverables
  on public.slr_entries;

create trigger zz_slr_entries_sync_review_deliverables
after insert or update
on public.slr_entries
for each row
execute function public.sync_slr_entry_review_deliverables_trigger();


-- Synchronize SLRs that existed before this migration.
do $$
declare
  row_record record;
begin
  for row_record in
    select id
    from public.slr_entries
  loop
    perform public.sync_slr_entry_review_deliverables(row_record.id);
  end loop;
end;
$$;
