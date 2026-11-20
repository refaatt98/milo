-- Server clock decides updated_at so incremental pulls never miss rows.
create or replace function milonote.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists records_touch on milonote.records;
create trigger records_touch before insert or update on milonote.records for each row execute function milonote.touch_updated_at();
