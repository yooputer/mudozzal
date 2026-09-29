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

export async function listZzals(page: number): Promise<Zzal[]> {
  const from = page * PAGE_SIZE
  const { data, error } = await supabase
    .from('zzals')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  if (error) throw error
  return data as Zzal[]
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
