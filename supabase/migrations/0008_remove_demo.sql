-- Demo patients are gone; every account now starts with its own empty profile.
drop function if exists public.clone_demo_patient(uuid, uuid);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Email sign-up sends "name"; Google sends "name" and "full_name".
  insert into public.patients (owner_user_id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'My profile')
  );
  return new;
end;
$$;
