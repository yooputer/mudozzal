'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  logUse, fetchableUrl, imageUrl, listZzals, PAGE_SIZE,
  type Query, type Zzal,
} from '@/lib/api'
import { copyImage, downloadImage } from '@/lib/clipboard'
import { Browser } from '@/components/Browser'
import { Header } from '@/components/Header'
import { CopyIcon, DownloadIcon, PlusIcon } from '@/components/icons'

export default function Page() {
  return (
    <>
      <Header />
      <main>
        {/* 조건이 바뀌면 목록을 새로 마운트해 페이지/무한스크롤 상태를 통째로 초기화한다 */}
        <Browser>{query => <Feed key={JSON.stringify(query)} query={query} />}</Browser>
      </main>
      <Link href="/upload" className="fab" aria-label="짤 올리기">
        <PlusIcon />
      </Link>
    </>
  )
}

function Feed({ query }: { query: Query }) {
  // CSS columns 는 항목이 늘 때마다 전체를 다시 나눠서 이미 본 짤이 옆 칸으로 옮겨간다.
  // 그래서 칸을 직접 나누고, 한 번 들어간 칸은 바꾸지 않는다.
  const [cols, setCols] = useState<Zzal[][]>([[], []])
  const colEls = useRef<(HTMLUListElement | null)[]>([])
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
      // 짧은 칸부터 채운다. 아직 안 그려진 새 짤은 높이를 모르니 정사각형으로 친다.
      const heights = colEls.current.map(el => el?.offsetHeight ?? 0)
      const width = colEls.current[0]?.offsetWidth ?? 1
      setCols(prev => {
        const next = prev.map(c => [...c])
        // 많이 쓴 순은 페이지 사이에 uses 가 바뀌면 행이 밀려 같은 짤이 또 온다
        const seen = new Set(prev.flat().map(z => z.id))
        for (const zzal of batch.filter(z => !seen.has(z.id))) {
          const i = heights[0] <= heights[1] ? 0 : 1
          next[i].push(zzal)
          heights[i] += width
        }
        return next
      })
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
      <div className="grid">
        {cols.map((col, i) => (
          <ul key={i} ref={el => { colEls.current[i] = el }}>
            {col.map(zzal => (
              <Card key={zzal.id} zzal={zzal} />
            ))}
          </ul>
        ))}
      </div>
      <div ref={sentinel} className="sentinel">
        {done && cols[0].length === 0 && '조건에 맞는 짤이 없습니다'}
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
