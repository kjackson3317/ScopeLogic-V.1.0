-- ScopeLogic review workflow refinement: persist optional capture-time action flags.
-- Review Notes remain internal evidence; these flags identify potential follow-up
-- only and do not automatically issue client deliverables.

alter table public.master_project_review_notes
  add column if not exists action_flags text[] not null default '{}'::text[];

alter table public.master_project_review_notes
  drop constraint if exists master_project_review_notes_action_flags_check;

alter table public.master_project_review_notes
  add constraint master_project_review_notes_action_flags_check
  check (
    action_flags <@ array[
      'RFI',
      'GC Clarification',
      'Contractor Clarification',
      'ScopeLogic Clarification',
      'VE Potential'
    ]::text[]
  );

notify pgrst, 'reload schema';
