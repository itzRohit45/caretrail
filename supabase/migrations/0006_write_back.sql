-- FR-14 doctor write-back: a doctor's upload is its own audit action, next to added_note.
alter table public.access_logs drop constraint access_logs_action_check;
alter table public.access_logs add constraint access_logs_action_check check (action in (
  'opened', 'viewed_document', 'added_note', 'added_document', 'emergency_scan', 'break_glass',
  'denied_out_of_scope', 'otp_failed'
));
