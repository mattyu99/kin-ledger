create extension if not exists pgcrypto;

create or replace function public.create_household_for_current_user(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(trim(p_name)) not between 1 and 80 then
    raise exception 'Household name must be between 1 and 80 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'User already belongs to a household' using errcode = '23505';
  end if;

  insert into public.profiles (id, email, display_name)
  select id, email,
    coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(email, 'member'), '@', 1))
  from auth.users where id = auth.uid()
  on conflict (id) do update set email = excluded.email;

  insert into public.households (name, currency, created_by)
  values (trim(p_name), 'TWD', auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  insert into public.categories (household_id, name, kind, color, icon) values
    (new_household_id, '日常採買', 'expense', '#d09835', '◈'),
    (new_household_id, '外食聚餐', 'expense', '#cf5c3b', '◉'),
    (new_household_id, '居家生活', 'expense', '#3d7568', '⌂'),
    (new_household_id, '交通出行', 'expense', '#6375a4', '↗'),
    (new_household_id, '醫療照護', 'expense', '#aa6480', '✳'),
    (new_household_id, '家庭收入', 'income', '#3d7568', '↙');

  return new_household_id;
end;
$$;

revoke all on function public.create_household_for_current_user(text) from public;
grant execute on function public.create_household_for_current_user(text) to authenticated;

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_max_uses integer default 5,
  p_expires_in_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_code text;
begin
  if auth.uid() is null or not public.has_household_role(p_household_id, array['owner', 'admin']) then
    raise exception 'Household administrator required' using errcode = '42501';
  end if;
  if p_max_uses not between 1 and 50 or p_expires_in_days not between 1 and 30 then
    raise exception 'Invalid invite limits' using errcode = '22023';
  end if;

  invite_code := encode(gen_random_bytes(16), 'hex');
  insert into public.household_invites (household_id, token_hash, created_by, expires_at, max_uses)
  values (
    p_household_id,
    encode(digest(invite_code, 'sha256'), 'hex'),
    auth.uid(),
    now() + make_interval(days => p_expires_in_days),
    p_max_uses
  );

  return invite_code;
end;
$$;

revoke all on function public.create_household_invite(uuid, integer, integer) from public;
grant execute on function public.create_household_invite(uuid, integer, integer) to authenticated;

create or replace function public.accept_household_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite_row public.household_invites%rowtype;
  normalized_code text := lower(trim(p_code));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(normalized_code) <> 32 or normalized_code !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid or expired invite code' using errcode = '22023';
  end if;

  select * into invite_row
  from public.household_invites
  where token_hash = encode(digest(normalized_code, 'sha256'), 'hex')
  for update;

  if not found or invite_row.expires_at <= now() or invite_row.used_count >= invite_row.max_uses then
    raise exception 'Invalid or expired invite code' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = invite_row.household_id and user_id = auth.uid()
  ) then
    return invite_row.household_id;
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'User already belongs to a household' using errcode = '23505';
  end if;

  insert into public.profiles (id, email, display_name)
  select id, email,
    coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(email, 'member'), '@', 1))
  from auth.users where id = auth.uid()
  on conflict (id) do update set email = excluded.email;

  insert into public.household_members (household_id, user_id, role)
  values (invite_row.household_id, auth.uid(), 'member');

  update public.household_invites
  set used_count = used_count + 1
  where id = invite_row.id;

  return invite_row.household_id;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;

alter table public.settlements add column if not exists client_id uuid;
create unique index if not exists settlements_household_client_id_idx
  on public.settlements (household_id, client_id);

create or replace function public.record_household_settlement(
  p_household_id uuid,
  p_client_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_settlement_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_client_id is null or p_amount_minor <= 0 or p_from_user_id = p_to_user_id then
    raise exception 'Invalid settlement details' using errcode = '22023';
  end if;
  if not public.is_household_member(p_household_id)
    or not exists (
      select 1 from public.household_members
      where household_id = p_household_id and user_id = auth.uid() and role <> 'viewer'
    ) then
    raise exception 'Household write access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_from_user_id
  ) or not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_to_user_id
  ) then
    raise exception 'Settlement members must belong to this household' using errcode = '23514';
  end if;

  insert into public.settlements (
    household_id, created_by, from_user_id, to_user_id, amount_minor, currency, client_id
  )
  select p_household_id, auth.uid(), p_from_user_id, p_to_user_id, p_amount_minor, currency, p_client_id
  from public.households
  where id = p_household_id
  on conflict (household_id, client_id) do nothing
  returning id into new_settlement_id;

  if new_settlement_id is null then
    select id into new_settlement_id
    from public.settlements
    where household_id = p_household_id and client_id = p_client_id;
  end if;

  if new_settlement_id is null then
    raise exception 'Household not found' using errcode = '23503';
  end if;
  return new_settlement_id;
end;
$$;

revoke all on function public.record_household_settlement(uuid, uuid, uuid, uuid, bigint) from public;
grant execute on function public.record_household_settlement(uuid, uuid, uuid, uuid, bigint) to authenticated;

create or replace function public.add_household_transaction(
  p_household_id uuid,
  p_client_id uuid,
  p_kind text,
  p_amount_minor bigint,
  p_note text,
  p_category_id uuid,
  p_payer_id uuid,
  p_occurred_at timestamptz,
  p_splits jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  household_currency text;
  new_transaction_id uuid;
  existing_transaction public.transactions%rowtype;
  split_record jsonb;
  split_user_id uuid;
  split_amount bigint;
  split_total bigint := 0;
  split_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_kind not in ('expense', 'income') or p_amount_minor <= 0 or p_client_id is null then
    raise exception 'Invalid transaction details' using errcode = '22023';
  end if;
  if jsonb_typeof(p_splits) <> 'array' then
    raise exception 'Splits must be an array' using errcode = '22023';
  end if;

  select role into actor_role
  from public.household_members
  where household_id = p_household_id and user_id = auth.uid();
  if actor_role is null or actor_role = 'viewer' then
    raise exception 'Household write access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_payer_id
  ) then
    raise exception 'Payer must belong to this household' using errcode = '23514';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories
    where id = p_category_id and household_id = p_household_id and kind = p_kind
  ) then
    raise exception 'Category must belong to this household and transaction type' using errcode = '23514';
  end if;

  for split_record in select value from jsonb_array_elements(p_splits)
  loop
    begin
      split_user_id := (split_record ->> 'user_id')::uuid;
      split_amount := (split_record ->> 'amount_minor')::bigint;
    exception when others then
      raise exception 'Invalid split entry' using errcode = '22023';
    end;

    if split_amount < 0 or not exists (
      select 1 from public.household_members
      where household_id = p_household_id and user_id = split_user_id
    ) then
      raise exception 'Split members must belong to this household' using errcode = '23514';
    end if;

    split_total := split_total + split_amount;
    split_count := split_count + 1;
  end loop;

  if (p_kind = 'expense' and (split_count = 0 or split_total <> p_amount_minor))
    or (p_kind = 'income' and split_count <> 0) then
    raise exception 'Splits must match the expense total' using errcode = '23514';
  end if;

  select currency into household_currency from public.households where id = p_household_id;
  if household_currency is null then
    raise exception 'Household not found' using errcode = '23503';
  end if;

  insert into public.transactions (
    household_id, creator_id, payer_id, category_id, kind, amount_minor,
    currency, note, occurred_at, client_id
  ) values (
    p_household_id, auth.uid(), p_payer_id, p_category_id, p_kind, p_amount_minor,
    household_currency, coalesce(p_note, ''), coalesce(p_occurred_at, now()), p_client_id
  )
  on conflict (household_id, client_id) do nothing
  returning id into new_transaction_id;

  if new_transaction_id is null then
    select * into existing_transaction
    from public.transactions
    where household_id = p_household_id and client_id = p_client_id;
    return existing_transaction.id;
  end if;

  for split_record in select value from jsonb_array_elements(p_splits)
  loop
    insert into public.transaction_splits (transaction_id, user_id, amount_minor)
    values (
      new_transaction_id,
      (split_record ->> 'user_id')::uuid,
      (split_record ->> 'amount_minor')::bigint
    );
  end loop;

  return new_transaction_id;
end;
$$;

revoke all on function public.add_household_transaction(uuid, uuid, text, bigint, text, uuid, uuid, timestamptz, jsonb) from public;
grant execute on function public.add_household_transaction(uuid, uuid, text, bigint, text, uuid, uuid, timestamptz, jsonb) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['transactions', 'settlements', 'categories', 'household_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'supabase_realtime publication is unavailable; realtime was not configured';
end;
$$;
