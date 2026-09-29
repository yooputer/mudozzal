-- 복사/다운로드 로그 + 같은 사람은 짤당 24시간에 한 번만 카운트. migrate-003 다음에 실행.

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

drop function bump_uses(uuid);

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
