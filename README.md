# 무한도전 짤 저장소

짤 보관 · 태깅 · 복사. 목록은 로그인 없이 볼 수 있고, 업로드만 로그인이 필요하다.

Next.js (App Router) + TS / Supabase (인증 + 메타데이터) / Cloudflare R2 (이미지).

## 설정

### 1. Supabase
1. 프로젝트 생성
2. SQL Editor 에서 `supabase/schema.sql` 실행
   - 이미 테이블이 있다면 `supabase/migrate-002.sql` 만 실행 (moods 복수화 + 비로그인 조회 허용)
   - 그 다음 `supabase/migrate-003.sql` 실행 (복사/다운로드 횟수 + 태그 목록 함수)
   - 그 다음 `supabase/migrate-004.sql` 실행 (복사/다운로드 로그, 24시간 중복 카운트 방지)
3. Authentication → URL Configuration → Redirect URLs 에 `http://localhost:3000` 과 배포 도메인 추가
4. Settings → API 에서 Project URL / anon key 복사

### 2. Cloudflare R2
1. 버킷 생성 (이름 `mudozzal`)
2. Settings → Public access → **r2.dev 서브도메인 허용** → 나오는 URL 이 `NEXT_PUBLIC_R2_PUBLIC_URL`
3. Settings → CORS policy (업로드 PUT 에만 필요하다):
   ```json
   [{
     "AllowedOrigins": ["http://localhost:3000", "https://<배포도메인>"],
     "AllowedMethods": ["PUT"],
     "AllowedHeaders": ["content-type"],
     "MaxAgeSeconds": 3600
   }]
   ```
   조회에는 CORS 가 필요 없다. `<img>` 는 R2 에서 직접 받고, 복사/다운로드는
   `/api/img/...` 프록시를 거친다 (아래 "이미지 프록시" 참고).
4. R2 → Manage API tokens → **Object Read & Write** 토큰 발급 → Access Key ID / Secret

### 3. 로컬 실행
```bash
cp .env.example .env.local   # 값 채우기
npm run dev                  # :3000
```

### 4. 배포
```bash
npx vercel --prod
```
Vercel 대시보드에 `.env.local` 의 변수를 전부 등록. `R2_*` 는 `NEXT_PUBLIC_` 접두사 없이 — 붙이면 시크릿이 클라이언트 번들에 박힌다.

## 이미지 프록시

복사/다운로드는 R2 URL 을 직접 `fetch` 하지 않고 `/api/img/<key>` 를 거친다.

r2.dev 가 `Origin` 없는 요청(= `<img>` 가 보내는 요청)에 `Vary: Origin` 을 붙이지 않아서,
브라우저가 그 응답(ACAO 없음)을 캐시해두고 이후 `fetch` 에 재사용한다. 그러면 origin 이
맞아도 CORS 로 막힌다. 이미지가 먼저 캐시됐는지에 따라 됐다 안 됐다 한다.

프록시는 같은 출처라 CORS 를 아예 타지 않고, 배포 도메인이 바뀌어도 설정할 게 없다.
표시용 `<img>` 는 계속 R2 에서 직접 받으므로 대역폭은 그대로 R2 로 나간다.
Vercel 을 경유하는 건 사용자가 버튼을 누른 순간의 바이트뿐이다.

## 알려진 한계

- **GIF 복사는 첫 프레임만.** 브라우저 클립보드가 애니메이션 GIF 를 못 받는다. 우회 불가. 원본 그대로 쓰려면 다운로드.
- 복사는 HTTPS 또는 localhost 에서만 동작 (Clipboard API 제약).
- 업로드 후 Supabase insert 가 실패하면 R2 에 고아 객체가 남는다. 쌓이면 R2 lifecycle rule 로 청소.
- 용량 제한 10MB 는 클라이언트에서만 검사. 혼자 쓰는 동안은 충분.
- 삭제 기능 없음.
- 목록은 `zzals` 테이블 전체 공개 읽기다. 남의 짤도 다 보인다 (의도된 동작).
