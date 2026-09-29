import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '무한도전 짤 저장소',
  description: '무한도전 짤 보관 · 태깅 · 복사',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
