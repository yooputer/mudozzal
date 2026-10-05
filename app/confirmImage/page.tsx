'use client'

import { useEffect, useRef, useState } from 'react'
import { confirmZzal, imageUrl, isAdmin, listZzals, PAGE_SIZE, type Query, type Zzal } from '@/lib/api'
import { MEMBERS } from '@/lib/members'
import { useSession } from '@/lib/useSession'
import { Browser, Toggles } from '@/components/Browser'
import { Header } from '@/components/Header'
import { Login } from '@/components/Login'
import { TagInput } from '@/components/TagInput'

export default function ConfirmImagePage() {
  const session = useSession()
  const [admin, setAdmin] = useState<boolean>()

  useEffect(() => {
    if (session) isAdmin().then(setAdmin, () => setAdmin(false))
  }, [session])

  if (session === undefined) return null
  if (session === null) return <Login notice="관리자만 볼 수 있습니다." />
  if (admin === undefined) return null

  return (
    <>
      <Header />
      <main>
        {admin ? (
          <Browser>{query => <List key={JSON.stringify(query)} query={query} />}</Browser>
        ) : (
          <p className="error">관리자 권한이 없습니다.</p>
        )}
      </main>
    </>
  )
}

function List({ query }: { query: Query }) {
  const [zzals, setZzals] = useState<Zzal[]>([])
  const [page, setPage] = useState(0)
  const [loaded, setLoaded] = useState(-1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  // 컨펌한 짤은 조건에서 빠지므로 그 수만큼 다음 페이지를 당긴다
  const shift = useRef(0)

  useEffect(() => {
    let live = true
    listZzals(page, { ...query, unconfirmed: true }, shift.current).then(
      batch => {
        if (!live) return
        // offset 페이지라 effect 가 다시 돌거나(HMR) 행이 밀리면 같은 짤이 또 온다
        setZzals(z => [...z, ...batch.filter(b => !z.some(v => v.id === b.id))])
        setLoaded(page)
        if (batch.length < PAGE_SIZE) setDone(true)
      },
      e => live && setError(e.message),
    )
    // StrictMode 의 이중 실행이 같은 페이지를 두 번 붙이지 않게
    return () => { live = false }
  }, [page, query])

  return (
    <>
      {error && <p className="error">{error}</p>}
      {zzals.map(zzal => (
        <Row
          key={zzal.id}
          zzal={zzal}
          onConfirmed={() => {
            setZzals(z => z.filter(v => v.id !== zzal.id))
            shift.current += 1
          }}
        />
      ))}
      {done ? (
        zzals.length === 0 && <p className="sentinel">컨펌할 짤이 없습니다</p>
      ) : (
        <button className="more" disabled={loaded < page} onClick={() => setPage(p => p + 1)}>더 보기</button>
      )}
    </>
  )
}

function Row({ zzal, onConfirmed }: { zzal: Zzal; onConfirmed: () => void }) {
  const [draft, setDraft] = useState(zzal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const edit = (patch: Partial<Zzal>) => setDraft(d => ({ ...d, ...patch }))
  const dirty = (['members', 'caption', 'moods'] as const).some(
    k => JSON.stringify(draft[k]) !== JSON.stringify(zzal[k]),
  )

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await confirmZzal(zzal.id, { members: draft.members, caption: draft.caption, moods: draft.moods })
      onConfirmed()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <article className="draft admin-row">
      <img className="preview" src={imageUrl(zzal.path)} alt={zzal.caption} loading="lazy" />
      <div className="fields">
        <div className="field">
          <span>멤버</span>
          <Toggles
            label="멤버"
            options={MEMBERS}
            selected={draft.members}
            onToggle={m =>
              edit({ members: draft.members.includes(m) ? draft.members.filter(v => v !== m) : [...draft.members, m] })
            }
          />
        </div>
        <label className="field">
          <span>자막</span>
          <input value={draft.caption} onChange={e => edit({ caption: e.target.value })} />
        </label>
        <div className="field">
          <span>상황 / 감정</span>
          <TagInput values={draft.moods} onChange={moods => edit({ moods })} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="admin-actions">
          {dirty && <button onClick={() => setDraft(zzal)} disabled={busy}>되돌리기</button>}
          <button className="primary" onClick={confirm} disabled={busy}>
            {busy ? '저장 중…' : dirty ? '수정 후 컨펌' : '컨펌'}
          </button>
        </div>
      </div>
    </article>
  )
}
