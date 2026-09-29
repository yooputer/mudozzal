-- 이미 zzals 테이블을 만들었다면 이것만 실행. 처음이면 schema.sql 쪽을 쓴다.

-- 1. mood(단수 text) -> moods(복수 text[])
alter table zzals add column moods text[] not null default '{}';
update zzals set moods = array[mood] where mood <> '';
alter table zzals drop column mood;

-- 2. 비로그인 조회 허용 - 기존 "for all" 정책을 목적별로 쪼갠다
drop policy "own rows" on zzals;

create policy "anyone reads" on zzals for select using (true);
create policy "own inserts" on zzals for insert with check (auth.uid() = user_id);
create policy "own updates" on zzals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own deletes" on zzals for delete using (auth.uid() = user_id);
