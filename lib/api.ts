import { supabase } from './supabase'

export const MAX_FILES = 5
export const MAX_BYTES = 10 * 1024 * 1024
export const PAGE_SIZE = 20

export type Zzal = {
  id: string
  path: string
  mime: string
  members: string[]
  caption: string
  moods: string[]
  created_at: string
}

/** 화면 표시용. <img> 는 CORS 를 타지 않으니 R2 에서 직접 받는다. */
export const imageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${path}`

/** 복사/다운로드용. fetch() 는 CORS 를 타므로 같은 출처 프록시를 거친다. */
export const fetchableUrl = (path: string) => `/api/img/${path}`

// user_id is deliberately left out: the table is world-readable now.
const COLUMNS = 'id, path, mime, members, caption, moods, created_at'

export type Sort = 'new' | 'old' | 'popular'

export type Query = {
  caption: string
  members: string[]
  moods: string[]
  sort: Sort
}

// Postgres 배열 리터럴. 태그에 쉼표나 따옴표가 들어가도 깨지지 않게 원소마다 따옴표로 감싼다.
const pgArray = (values: string[]) => `{${values.map(v => JSON.stringify(v)).join(',')}}`

export async function listZzals(page: number, q: Query): Promise<Zzal[]> {
  const from = page * PAGE_SIZE
  let req = supabase.from('zzals').select(COLUMNS)

  // LIKE 와일드카드를 글자 그대로 찾도록 이스케이프
  const caption = q.caption.trim().replace(/[\\%_]/g, '\\$&')
  if (caption) req = req.ilike('caption', `%${caption}%`)
  // 같은 그룹 안에서는 하나라도 맞으면(OR), 그룹끼리는 모두 맞아야(AND)
  if (q.members.length) req = req.overlaps('members', pgArray(q.members))
  if (q.moods.length) req = req.overlaps('moods', pgArray(q.moods))

  if (q.sort === 'popular') req = req.order('uses', { ascending: false })
  // id 는 created_at 이 같은 행끼리 페이지 경계에서 순서가 뒤바뀌지 않게 하는 타이브레이커
  const ascending = q.sort === 'old'
  const { data, error } = await req
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return data as Zzal[]
}

export async function listMoodTags(): Promise<string[]> {
  const { data, error } = await supabase.rpc('mood_tags')
  if (error) throw error
  return data as string[]
}

// 비로그인 사용자를 구분하는 브라우저별 식별자. 저장소가 막힌 환경이면 탭마다 새로 만든다.
let visitorId = ''
function visitor() {
  if (visitorId) return visitorId
  try {
    visitorId = localStorage.getItem('visitor') ?? ''
    if (!visitorId) localStorage.setItem('visitor', (visitorId = crypto.randomUUID()))
  } catch {
    visitorId ||= crypto.randomUUID()
  }
  return visitorId
}

/** 복사/다운로드 로그. 카운트(24시간에 한 번)는 DB 가 판단한다.
 *  실패해도 사용자 동작에는 영향 없으니 결과를 기다리지 않는다. */
export const logUse = (id: string, action: 'copy' | 'download') => {
  supabase
    .rpc('log_use', { p_zzal_id: id, p_action: action, p_visitor: visitor() })
    .then(({ error }) => error && console.warn(error))
}

export type Draft = {
  file: File
  members: string[]
  caption: string
  moods: string[]
}

export async function uploadZzal(draft: Draft) {
  if (draft.file.size > MAX_BYTES) throw new Error('10MB를 넘는 파일')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다')

  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ mime: draft.file.type }),
  })
  if (!res.ok) throw new Error(await res.text())

  const { uploadUrl, key } = await res.json()

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': draft.file.type },
    body: draft.file,
  })
  if (!put.ok) throw new Error(`R2 업로드 실패 (${put.status})`)

  // ponytail: a failed insert leaves the R2 object orphaned. Harmless at 5 files a
  // batch; add an R2 lifecycle rule if that ever adds up.
  const { error } = await supabase.from('zzals').insert({
    user_id: session.user.id,
    path: key,
    mime: draft.file.type,
    members: draft.members,
    caption: draft.caption,
    moods: draft.moods,
  })
  if (error) throw error
}
