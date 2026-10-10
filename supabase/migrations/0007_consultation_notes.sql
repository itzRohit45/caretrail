-- A record can be the consultation notes a patient typed (rendered to a PDF on their device),
-- with or without a photo of the prescription.
alter table public.documents drop constraint documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('prescription', 'lab_report', 'discharge_summary', 'scan_report', 'consultation_note', 'other'));
