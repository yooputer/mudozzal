-- Supabase SQL Editor 에서 실행.

create table zzals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null,                    -- R2 object key
  mime       text not null,
  members    text[] not null default '{}',
  caption    text not null default '',
  moods      text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index zzals_created on zzals (created_at desc);

alter table zzals enable row level security;

-- 짤 목록은 로그인 없이 볼 수 있다.
create policy "anyone reads" on zzals
  for select
  using (true);

-- 쓰기는 본인 것만.
create policy "own inserts" on zzals
  for insert
  with check (auth.uid() = user_id);

create policy "own updates" on zzals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own deletes" on zzals
  for delete
  using (auth.uid() = user_id);
