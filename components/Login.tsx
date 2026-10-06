'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GoogleIcon } from './icons'

export function Login({ notice }: { notice?: string }) {
  const [error, setError] = useState('')

  async function signIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
    if (error) setError(error.message)
  }

  return (
    <main className="login">
      <h1>무한도전 짤 저장소</h1>
      {notice && <p className="notice">{notice}</p>}
      <button className="google" onClick={signIn}>
        <GoogleIcon />
        Google 계정으로 로그인
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  )
}
