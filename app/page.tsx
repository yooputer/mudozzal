'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  logUse, fetchableUrl, imageUrl, listMoodTags, listZzals, PAGE_SIZE,
  type Query, type Sort, type Zzal,
} from '@/lib/api'
import { copyImage, downloadImage } from '@/lib/clipboard'
import { MEMBERS } from '@/lib/members'
import { Header } from '@/components/Header'
import { CopyIcon, DownloadIcon, PlusIcon } from '@/components/icons'

const MAX_MOODS = 10
const SORTS: Sort[] = ['new', 'old', 'popular']

// 새로고침/공유해도 조건이 남도록 URL 에 담는다. 예: ?q=마음&member=유재석,박명수&mood=만족&sort=old
// 태그에는 쉼표가 들어갈 수 없으므로(TagInput 에서 막는다) 쉼표를 구분자로 쓴다.
const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : [])

function fromUrl(search: string): Query {
  const p = new URLSearchParams(search)
  const sort = p.get('sort') as Sort
  return {
    caption: p.get('q') ?? '',
    members: list(p.get('member')).filter(m => (MEMBERS as readonly string[]).includes(m)),
    moods: list(p.get('mood')).slice(0, MAX_MOODS),
    sort: SORTS.includes(sort) ? sort : 'new',
  }
}

// URLSearchParams 는 쉼표를 %2C 로 바꿔버려서 직접 조립한다
function toUrl(q: Query) {
  const parts: string[] = []
  const add = (key: string, values: string[]) =>
    values.length && parts.push(`${key}=${values.map(encodeURIComponent).join(',')}`)
  add('q', q.caption ? [q.caption] : [])
  add('member', q.members)
  add('mood', q.moods)
  if (q.sort !== 'new') parts.push(`sort=${q.sort}`)
  return parts.length ? `?${parts.join('&')}` : location.pathname
}

// useSearchParams 는 Suspense 경계가 있어야 빌드된다
export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  )
}

function Home() {
  const [text, setText] = useState('')
  const [query, setQuery] = useState<Query>({ caption: '', members: [], moods: [], sort: 'new' })
  // URL 을 읽기 전에 목록을 그리면 기본 조건으로 한 번 헛요청하므로 읽을 때까지 기다린다.
  // 첫 렌더에서 바로 읽지 않는 이유: 서버 렌더 결과와 달라져 hydration 오류가 난다.
  const [ready, setReady] = useState(false)
  const [moodTags, setMoodTags] = useState<string[]>([])
  const dropdown = useRef<HTMLDetailsElement>(null)

  // <details> 는 바깥 클릭으로 닫히지 않으니 직접 닫는다
  useEffect(() => {
    function close(e: PointerEvent) {
      const el = dropdown.current
      if (el?.open && !el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  // 주소가 바뀔 때마다(첫 진입, 로고 클릭, 뒤로가기) 조건을 주소에 맞춘다.
  // 우리가 replaceState 로 쓴 주소가 돌아온 경우는 이미 같으니 건드리지 않는다
  // - 안 그러면 입력 중인 검색어를 덮어쓴다.
  const search = useSearchParams().toString()
  const current = useRef(query)
  current.current = query
  useEffect(() => {
    const q = fromUrl(search)
    if (JSON.stringify(q) === JSON.stringify(current.current)) return setReady(true)
    setQuery(q)
    setText(q.caption)
    setReady(true)
  }, [search])

  useEffect(() => {
    if (ready) history.replaceState(null, '', toUrl(query))
  }, [ready, query])

  useEffect(() => {
    listMoodTags().then(setMoodTags, () => {})
  }, [])

  // 타이핑마다 요청하지 않도록 잠깐 멈췄을 때 반영
  useEffect(() => {
    const t = setTimeout(() => setQuery(q => ({ ...q, caption: text })), 300)
    return () => clearTimeout(t)
  }, [text])

  const toggle = (key: 'members' | 'moods', value: string) =>
    setQuery(q => ({
      ...q,
      [key]: q[key].includes(value) ? q[key].filter(v => v !== value) : [...q[key], value],
    }))

  return (
    <>
      <Header />
      <main>
        <div className="filters">
          <Toggles label="멤버" options={MEMBERS} selected={query.members} onToggle={v => toggle('members', v)} />
          <div className="search">
            <input
              type="search"
              value={text}
              placeholder="자막 검색"
              aria-label="자막 검색"
              onChange={e => setText(e.target.value)}
            />
            <select
              value={query.sort}
              aria-label="정렬"
              onChange={e => setQuery(q => ({ ...q, sort: e.target.value as Sort }))}
            >
              <option value="new">최신순</option>
              <option value="old">오래된순</option>
              <option value="popular">많이 쓴 순</option>
            </select>
          </div>
          {/* 드롭다운 버튼 옆에 선택된 태그. 펼친 목록은 이 줄 전체 폭으로 뜬다 */}
          <div className="filter-row">
            {moodTags.length > 0 && (
              // 태그가 계속 늘어나므로 접어둔다
              <details className="dropdown" ref={dropdown}>
                <summary>
                  상황/감정{query.moods.length > 0 && ` (${query.moods.length}/${MAX_MOODS})`}
                </summary>
                <Toggles label="상황/감정" options={moodTags} selected={query.moods} onToggle={v => toggle('moods', v)} max={MAX_MOODS} />
              </details>
            )}
            {query.moods.length > 0 && (
              <div className="toggles" aria-label="선택된 상황/감정">
                {query.moods.map(mood => (
                  <button key={mood} className="chip" onClick={() => toggle('moods', mood)}>
                    {mood} ✕
                  </button>
                ))}
                <button className="clear" onClick={() => setQuery(q => ({ ...q, moods: [] }))}>
                  전체 삭제
                </button>
              </div>
            )}
          </div>
        </div>
        {/* 조건이 바뀌면 목록을 새로 마운트해 페이지/무한스크롤 상태를 통째로 초기화한다 */}
        {ready && <Feed key={JSON.stringify(query)} query={query} />}
      </main>
      <Link href="/upload" className="fab" aria-label="짤 올리기">
        <PlusIcon />
      </Link>
    </>
  )
}

function Toggles({ label, options, selected, onToggle, max = Infinity }: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  max?: number
}) {
  const full = selected.length >= max
  return (
    <div className="toggles" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option}
          className="toggle"
          aria-pressed={selected.includes(option)}
          disabled={full && !selected.includes(option)}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function Feed({ query }: { query: Query }) {
  const [zzals, setZzals] = useState<Zzal[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // A ref, not state: the observer fires again before a state update lands and
  // would load the same page twice.
  const busy = useRef(false)
  const page = useRef(0)
  const sentinel = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (busy.current || done) return
    busy.current = true
    try {
      const batch = await listZzals(page.current, query)
      page.current += 1
      setZzals(prev => [...prev, ...batch])
      if (batch.length < PAGE_SIZE) setDone(true)
    } catch (e) {
      setError((e as Error).message)
      setDone(true)
    } finally {
      busy.current = false
    }
  }, [done, query])

  // 첫 페이지는 관찰자와 무관하게 불러온다. 백그라운드 탭에서는
  // IntersectionObserver 가 발화하지 않아 목록이 빈 채로 남는다.
  useEffect(() => {
    loadMore()
  }, [loadMore])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore()
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <>
      {error && <p className="error">{error}</p>}
      <ul className="grid">
        {zzals.map(zzal => (
          <Card key={zzal.id} zzal={zzal} />
        ))}
      </ul>
      <div ref={sentinel} className="sentinel">
        {done && zzals.length === 0 && '조건에 맞는 짤이 없습니다'}
      </div>
    </>
  )
}

function Card({ zzal }: { zzal: Zzal }) {
  const [toast, setToast] = useState('')
  const src = fetchableUrl(zzal.path)

  function flash(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2000)
  }

  async function copy() {
    try {
      await copyImage(src)
      logUse(zzal.id, 'copy')
      flash(zzal.mime === 'image/gif' ? '복사됨 (GIF는 첫 프레임만)' : '복사됨')
    } catch (e) {
      flash((e as Error).message)
    }
  }

  async function download() {
    try {
      await downloadImage(src, zzal.path.split('/').pop()!)
      logUse(zzal.id, 'download')
    } catch (e) {
      flash((e as Error).message)
    }
  }

  return (
    <li className="card">
      {/* next/image 를 쓰지 않는 이유: R2 이미지는 최적화 이득이 거의 없고,
          도메인을 remotePatterns 에 등록하는 설정만 늘어난다. */}
      <img src={imageUrl(zzal.path)} alt={zzal.caption} loading="lazy" />
      <div className="actions">
        <button onClick={copy} aria-label="복사">
          <CopyIcon />
        </button>
        <button onClick={download} aria-label="다운로드">
          <DownloadIcon />
        </button>
      </div>
      {toast && <span className="toast">{toast}</span>}
    </li>
  )
}
