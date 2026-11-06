-- Some clients have an ADDRESS typed in the PIC box (clients.contact_name), e.g. "JL. BRIGJEN KATAMSO NO. 739 RT. 000 ...".
-- This moves it to the billing address (when the client has none yet) and empties the PIC, so the PIC can be a person's name.
-- Run it in the Supabase SQL editor of the Accounting app. It keeps a backup table of what it changed. Safe to run twice.

-- 1. LOOK FIRST (optional): which clients are affected
-- select id, name, contact_name, billing_address from public.clients
-- where contact_name is not null and (
--   length(contact_name) > 40
--   or contact_name ~* '\m(jl|jln|jalan|no|rt|rw|kel|kec|kota|kab|blok|lantai)\.?\s*\d'
--   or contact_name ~* '\m(jalan|kota|kelurahan|kecamatan|kabupaten)\M'
--   or contact_name ~ '\d{5}'
-- ) order by name;

-- 2. Backup of the rows that are changed
create table if not exists public.clients_pic_backup_20261107 as
select id, name, contact_name, billing_address, now() as backed_up_at
from public.clients
where false;

insert into public.clients_pic_backup_20261107 (id, name, contact_name, billing_address)
select c.id, c.name, c.contact_name, c.billing_address
from public.clients c
where c.contact_name is not null
  and (
    length(c.contact_name) > 40
    or c.contact_name ~* '\m(jl|jln|jalan|no|rt|rw|kel|kec|kota|kab|blok|lantai)\.?\s*\d'
    or c.contact_name ~* '\m(jalan|kota|kelurahan|kecamatan|kabupaten)\M'
    or c.contact_name ~ '\d{5}'
  )
  and not exists (select 1 from public.clients_pic_backup_20261107 b where b.id = c.id);

-- 3. The address goes to the billing address when that is empty; the PIC is emptied
update public.clients c
set billing_address = case when coalesce(btrim(c.billing_address), '') = '' then c.contact_name else c.billing_address end,
    contact_name = null
where c.id in (select id from public.clients_pic_backup_20261107)
  and c.contact_name is not null;

-- 4. Result
select count(*) as pic_cleaned from public.clients_pic_backup_20261107;
