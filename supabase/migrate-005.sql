-- 관리자: 남의 짤(벌크 업로드분 포함)도 수정할 수 있다. migrate-004 다음에 실행.

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

-- 관리자 지정: insert into admins (user_id) select id from auth.users where email = '...';
