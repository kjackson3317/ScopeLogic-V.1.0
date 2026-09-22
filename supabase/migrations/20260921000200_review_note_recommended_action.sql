-- Add optional recommended downstream action / solution to Review Notes.
-- Review Notes remain Master Project records and do not require a Client Engagement.

alter table public.master_project_review_notes
  add column if not exists recommended_action text not null default '';

comment on column public.master_project_review_notes.recommended_action is
  'Optional internal recommendation describing the suggested downstream deliverable/action and proposed solution.';
