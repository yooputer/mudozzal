'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | string>('idle')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setStatus(error ? error.message : 'sent')
  }

  return (
    <main className="login">
      <h1>무한도전 짤 저장소</h1>

      {status === 'sent' ? (
        <p>{email} 로 로그인 링크를 보냈습니다. 메일함을 확인하세요.</p>
      ) : (
        <>
          {notice && <p className="notice">{notice}</p>}
          <form onSubmit={send}>
            <input
              type="email"
              required
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button className="primary" disabled={status === 'sending'}>
              {status === 'sending' ? '보내는 중…' : '로그인 링크 받기'}
            </button>
          </form>
          {status !== 'idle' && status !== 'sending' && (
            <p className="error">{status}</p>
          )}
        </>
      )}
    </main>
  )
}
