-- 검색 / 필터 / 정렬. 이미 zzals 테이블이 있다면 이것만 실행. 처음이면 schema.sql 쪽을 쓴다.

-- 복사 + 다운로드 횟수
alter table zzals add column uses integer not null default 0;
create index zzals_uses on zzals (uses desc, created_at desc);

-- 수정 권한은 본인에게만 있으므로, 남의 짤 카운트는 이 함수로만 올린다.
create function bump_uses(zzal_id uuid) returns void
language sql security definer set search_path = public as $$
  update zzals set uses = uses + 1 where id = zzal_id;
$$;

-- 필터에 띄울 상황/감정 태그 목록
create function mood_tags() returns setof text
language sql stable as $$
  select distinct unnest(moods) from zzals order by 1;
$$;
