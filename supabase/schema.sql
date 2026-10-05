-- Supabase SQL Editor 에서 실행.

create table zzals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null,                    -- R2 object key
  mime       text not null,
  members    text[] not null default '{}',
  caption    text not null default '',
  moods      text[] not null default '{}',
  uses       integer not null default 0,       -- 복사 + 다운로드 횟수
  confirmed  boolean not null default false,   -- 관리자가 내용을 확인했는지
  created_at timestamptz not null default now()
);

create index zzals_created on zzals (created_at desc);
create index zzals_uses on zzals (uses desc, created_at desc);

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

-- 복사/다운로드 로그. 남의 짤 카운트도 올려야 하므로 log_use 함수로만 쓴다.
create table zzal_uses (
  id         bigint generated always as identity primary key,
  zzal_id    uuid not null references zzals(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,  -- 비로그인이면 null
  visitor    uuid not null,                                       -- 브라우저별 식별자
  action     text not null check (action in ('copy', 'download')),
  created_at timestamptz not null default now()
);

create index zzal_uses_recent on zzal_uses (zzal_id, created_at desc);

-- 정책 없음 = API 로는 읽기/쓰기 불가. 아래 함수만 쓸 수 있고, 조회는 대시보드에서.
alter table zzal_uses enable row level security;

-- 로그는 매번 남기고, uses 는 같은 사람(계정 또는 브라우저)의 최근 24시간 기록이 없을 때만 올린다.
-- ponytail: 동시에 두 번 누르면 둘 다 카운트될 수 있다. 문제되면 advisory lock.
create function log_use(p_zzal_id uuid, p_action text, p_visitor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from zzal_uses
    where zzal_id = p_zzal_id
      and created_at > now() - interval '24 hours'
      and (visitor = p_visitor or user_id = auth.uid())
  ) then
    update zzals set uses = uses + 1 where id = p_zzal_id;
  end if;

  insert into zzal_uses (zzal_id, user_id, visitor, action)
  values (p_zzal_id, auth.uid(), p_visitor, p_action);
end;
$$;

-- 필터에 띄울 상황/감정 태그 목록
create function mood_tags() returns setof text
language sql stable as $$
  select distinct unnest(moods) from zzals order by 1;
$$;

-- 관리자: 남의 짤도 수정할 수 있다.
-- 정책 없음 = API 로는 읽기/쓰기 불가. 관리자 추가는 대시보드에서.
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create policy "admin updates" on zzals
  for update
  using (is_admin())
  with check (is_admin());
