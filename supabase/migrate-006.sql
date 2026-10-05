-- 관리자 컨펌 여부. migrate-005 다음에 실행.
-- ponytail: 업로더도 "own updates" 로 자기 짤을 confirmed 로 바꿀 수 있다. 문제되면 컬럼 권한이나 트리거로 막는다.
alter table zzals add column confirmed boolean not null default false;
