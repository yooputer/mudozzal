'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Login } from '@/components/Login'
import { useSession } from '@/lib/useSession'

export default function LoginPage() {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.replace('/')
  }, [session, router])

  if (session !== null) return null
  return <Login />
}
