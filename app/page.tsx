'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchableUrl, imageUrl, listZzals, PAGE_SIZE, type Zzal } from '@/lib/api'
import { copyImage, downloadImage } from '@/lib/clipboard'
import { Header } from '@/components/Header'
import { CopyIcon, DownloadIcon, PlusIcon } from '@/components/icons'

export default function Page() {
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
      const batch = await listZzals(page.current)
      page.current += 1
      setZzals(prev => [...prev, ...batch])
      if (batch.length < PAGE_SIZE) setDone(true)
    } catch (e) {
      setError((e as Error).message)
      setDone(true)
    } finally {
      busy.current = false
    }
  }, [done])

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
      <Header />
      <main>
        {error && <p className="error">{error}</p>}
        <ul className="grid">
          {zzals.map(zzal => (
            <Card key={zzal.id} zzal={zzal} />
          ))}
        </ul>
        <div ref={sentinel} className="sentinel">
          {done && zzals.length === 0 && '아직 짤이 없습니다'}
        </div>
      </main>
      <Link href="/upload" className="fab" aria-label="짤 올리기">
        <PlusIcon />
      </Link>
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
      flash(zzal.mime === 'image/gif' ? '복사됨 (GIF는 첫 프레임만)' : '복사됨')
    } catch (e) {
      flash((e as Error).message)
    }
  }

  async function download() {
    try {
      await downloadImage(src, zzal.path.split('/').pop()!)
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
