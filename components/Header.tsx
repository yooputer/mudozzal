'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/useSession'

export function Header() {
  const session = useSession()

  return (
    <header>
      <Link href="/" className="brand">무한도전 짤 저장소</Link>
      {session === undefined ? null : session ? (
        <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
      ) : (
        <Link href="/login" className="button">로그인</Link>
      )}
    </header>
  )
}
