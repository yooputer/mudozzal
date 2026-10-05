'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { listMoodTags, type Query, type Sort } from '@/lib/api'
import { MEMBERS } from '@/lib/members'

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

/** 검색/필터/정렬 바. 조건이 정해지면 children(query) 로 목록을 그린다. */
// useSearchParams 는 Suspense 경계가 있어야 빌드된다
export function Browser({ children }: { children: (query: Query) => ReactNode }) {
  return (
    <Suspense>
      <Filters>{children}</Filters>
    </Suspense>
  )
}

function Filters({ children }: { children: (query: Query) => ReactNode }) {
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
      {ready && children(query)}
    </>
  )
}

export function Toggles({ label, options, selected, onToggle, max = Infinity }: {
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
          type="button"
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
