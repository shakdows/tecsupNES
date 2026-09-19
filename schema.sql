create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_color text not null default '#0072FF',
  status text not null default 'offline' check (status in ('online','away','offline')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

--(nombres, avatar)
create policy "profiles_select_all"
  on public.profiles for select
  to authenticated
  using (true);

--actualizar su propio perfil
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

--perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    ('#' || substr(md5(new.id::text), 1, 6))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


create table if not exists public.locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  sharing_enabled boolean not null default false,
  radius_m integer not null default 1000,
  updated_at timestamptz not null default now()
);

alter table public.locations enable row level security;


create policy "locations_select_shared_or_own"
  on public.locations for select
  to authenticated
  using (sharing_enabled = true or user_id = auth.uid());

create policy "locations_upsert_own"
  on public.locations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "locations_update_own"
  on public.locations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "locations_delete_own"
  on public.locations for delete
  to authenticated
  using (user_id = auth.uid());


create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "groups_select_member"
  on public.groups for select
  to authenticated
  using (
    id in (select group_id from public.group_members where user_id = auth.uid())
  );

create policy "groups_insert_own"
  on public.groups for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "group_members_select_if_member"
  on public.group_members for select
  to authenticated
  using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
  );

create policy "group_members_insert_owner_or_self"
  on public.group_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or group_id in (select id from public.groups where owner_id = auth.uid())
  );


create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  scope text check (scope in ('direct','group','broadcast_all','broadcast_near','geo')) not null,
  text text not null default '',
  latitude double precision,
  longitude double precision,
  radius_m integer,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;


create policy "messages_select_relevant"
  on public.messages for select
  to authenticated
  using (
    scope = 'broadcast_all'
    or scope in ('broadcast_near','geo')
    or (scope = 'direct' and (sender_id = auth.uid() or receiver_id = auth.uid()))
    or (scope = 'group' and group_id in (select group_id from public.group_members where user_id = auth.uid()))
  );

create policy "messages_insert_own"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      scope <> 'group'
      or group_id in (select group_id from public.group_members where user_id = auth.uid())
    )
  );

create policy "messages_update_receiver_marks_read"
  on public.messages for update
  to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());


create or replace function public.haversine_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision as $$
  select 2 * 6371 * asin(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) *
      sin(radians(lon2 - lon1) / 2) ^ 2
    )
  );
$$ language sql immutable;


alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.profiles;


create index if not exists idx_messages_direct on public.messages (sender_id, receiver_id) where scope = 'direct';
create index if not exists idx_messages_group on public.messages (group_id) where scope = 'group';
create index if not exists idx_messages_scope_created on public.messages (scope, created_at desc);
create index if not exists idx_locations_sharing on public.locations (sharing_enabled) where sharing_enabled = true;
