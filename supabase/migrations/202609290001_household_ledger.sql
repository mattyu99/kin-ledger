create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  currency text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 50),
  kind text not null check (kind in ('expense', 'income')),
  color text not null default '#5a7894',
  icon text not null default '•',
  unique (household_id, name, kind)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('expense', 'income')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  note text not null default '' check (length(note) <= 500),
  occurred_at timestamptz not null default now(),
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, client_id)
);

create table if not exists public.transaction_splits (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (transaction_id, user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  from_user_id uuid not null references public.profiles(id) on delete restrict,
  to_user_id uuid not null references public.profiles(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  note text not null default '' check (length(note) <= 500),
  occurred_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  created_at timestamptz not null default now()
);

create index if not exists transactions_household_occurred_idx
  on public.transactions (household_id, occurred_at desc);
create index if not exists splits_user_idx on public.transaction_splits (user_id);
create index if not exists settlements_household_occurred_idx
  on public.settlements (household_id, occurred_at desc);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.has_household_role(target_household_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

revoke all on function public.has_household_role(uuid, text[]) from public;
grant execute on function public.has_household_role(uuid, text[]) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'member'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.household_invites enable row level security;

drop policy if exists profiles_read_household on public.profiles;
create policy profiles_read_household on public.profiles for select to authenticated
using (
  id = auth.uid() or exists (
    select 1
    from public.household_members as viewer
    join public.household_members as subject using (household_id)
    where viewer.user_id = auth.uid() and subject.user_id = profiles.id
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists households_read_members on public.households;
create policy households_read_members on public.households for select to authenticated
using (created_by = auth.uid() or public.is_household_member(id));

drop policy if exists households_create_self on public.households;
create policy households_create_self on public.households for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists households_update_admin on public.households;
create policy households_update_admin on public.households for update to authenticated
using (public.has_household_role(id, array['owner', 'admin']))
with check (public.has_household_role(id, array['owner', 'admin']));

drop policy if exists memberships_read_household on public.household_members;
create policy memberships_read_household on public.household_members for select to authenticated
using (user_id = auth.uid() or public.is_household_member(household_id));

drop policy if exists memberships_bootstrap_owner on public.household_members;
create policy memberships_bootstrap_owner on public.household_members for insert to authenticated
with check (
  user_id = auth.uid() and role = 'owner' and exists (
    select 1 from public.households where id = household_id and created_by = auth.uid()
  )
);

drop policy if exists memberships_manage_non_owner on public.household_members;
create policy memberships_manage_non_owner on public.household_members for all to authenticated
using (
  role <> 'owner' and public.has_household_role(household_id, array['owner', 'admin'])
)
with check (
  role in ('admin', 'member', 'viewer')
  and public.has_household_role(household_id, array['owner', 'admin'])
);

drop policy if exists categories_read_household on public.categories;
create policy categories_read_household on public.categories for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists categories_manage_admin on public.categories;
create policy categories_manage_admin on public.categories for all to authenticated
using (public.has_household_role(household_id, array['owner', 'admin']))
with check (public.has_household_role(household_id, array['owner', 'admin']));

drop policy if exists transactions_read_household on public.transactions;
create policy transactions_read_household on public.transactions for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists transactions_insert_member on public.transactions;
create policy transactions_insert_member on public.transactions for insert to authenticated
with check (
  creator_id = auth.uid()
  and public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as actor
    where actor.household_id = transactions.household_id
      and actor.user_id = auth.uid() and actor.role <> 'viewer'
  )
  and exists (
    select 1 from public.household_members as payer
    where payer.household_id = transactions.household_id and payer.user_id = transactions.payer_id
  )
  and (
    category_id is null or exists (
      select 1 from public.categories as category
      where category.id = transactions.category_id and category.household_id = transactions.household_id
    )
  )
);

drop policy if exists transactions_update_member on public.transactions;
create policy transactions_update_member on public.transactions for update to authenticated
using (
  creator_id = auth.uid()
  and public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as actor
    where actor.household_id = transactions.household_id
      and actor.user_id = auth.uid() and actor.role <> 'viewer'
  )
)
with check (
  creator_id = auth.uid()
  and public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as actor
    where actor.household_id = transactions.household_id
      and actor.user_id = auth.uid() and actor.role <> 'viewer'
  )
  and exists (
    select 1 from public.household_members as payer
    where payer.household_id = transactions.household_id and payer.user_id = transactions.payer_id
  )
  and (
    category_id is null or exists (
      select 1 from public.categories as category
      where category.id = transactions.category_id and category.household_id = transactions.household_id
    )
  )
);

drop policy if exists transactions_delete_member on public.transactions;
create policy transactions_delete_member on public.transactions for delete to authenticated
using (
  public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as actor
    where actor.household_id = transactions.household_id
      and actor.user_id = auth.uid() and actor.role <> 'viewer'
      and (transactions.creator_id = auth.uid() or actor.role in ('owner', 'admin'))
  )
);

drop policy if exists splits_read_household on public.transaction_splits;
create policy splits_read_household on public.transaction_splits for select to authenticated
using (exists (
  select 1 from public.transactions as transaction
  where transaction.id = transaction_id and public.is_household_member(transaction.household_id)
));

drop policy if exists splits_manage_household on public.transaction_splits;
create policy splits_manage_household on public.transaction_splits for all to authenticated
using (exists (
  select 1 from public.transactions as transaction
  join public.household_members as actor
    on actor.household_id = transaction.household_id and actor.user_id = auth.uid()
  where transaction.id = transaction_splits.transaction_id
    and public.is_household_member(transaction.household_id)
    and actor.role <> 'viewer'
))
with check (exists (
  select 1
  from public.transactions as transaction
  join public.household_members as participant
    on participant.household_id = transaction.household_id
    and participant.user_id = transaction_splits.user_id
  join public.household_members as actor
    on actor.household_id = transaction.household_id and actor.user_id = auth.uid()
  where transaction.id = transaction_splits.transaction_id
    and public.is_household_member(transaction.household_id)
    and actor.role <> 'viewer'
));

drop policy if exists settlements_read_household on public.settlements;
create policy settlements_read_household on public.settlements for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists settlements_insert_member on public.settlements;
create policy settlements_insert_member on public.settlements for insert to authenticated
with check (
  created_by = auth.uid() and public.is_household_member(household_id)
  and exists (
    select 1 from public.household_members as payer
    join public.household_members as receiver using (household_id)
    where payer.household_id = settlements.household_id
      and payer.user_id = from_user_id and receiver.user_id = to_user_id
  )
  and exists (
    select 1 from public.household_members as actor
    where actor.household_id = settlements.household_id
      and actor.user_id = auth.uid() and actor.role <> 'viewer'
  )
);

drop policy if exists invites_read_admin on public.household_invites;
create policy invites_read_admin on public.household_invites for select to authenticated
using (public.has_household_role(household_id, array['owner', 'admin']));

drop policy if exists invites_manage_admin on public.household_invites;
create policy invites_manage_admin on public.household_invites for all to authenticated
using (public.has_household_role(household_id, array['owner', 'admin']))
with check (created_by = auth.uid() and public.has_household_role(household_id, array['owner', 'admin']));