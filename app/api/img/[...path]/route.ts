// 이미지를 같은 출처로 중계한다. <img> 는 CORS 없이 뜨지만 복사/다운로드의
// fetch() 는 CORS 를 타서, 접속한 주소가 R2 의 AllowedOrigins 에 없으면
// "Failed to fetch" 로 죽는다 (localhost 와 127.0.0.1 도 서로 다른 출처다).
// 버킷은 이미 공개라 이 라우트가 새로 노출하는 것은 없다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params

  if (path.some(segment => !segment || segment === '.' || segment === '..')) {
    return new Response('Bad path', { status: 400 })
  }

  const upstream = await fetch(
    `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${path.map(encodeURIComponent).join('/')}`,
  )
  if (!upstream.ok) return new Response('Not found', { status: upstream.status })

  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      // 키에 UUID 가 들어가 내용이 바뀔 일이 없다.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
