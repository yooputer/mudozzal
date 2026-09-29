'use client'

import { useState } from 'react'
import { TagInput } from '@/components/TagInput'

export default function TagTest() {
  const [moods, setMoods] = useState<string[]>([])
  return (
    <main>
      <TagInput values={moods} onChange={setMoods} />
      <pre id="dump">{JSON.stringify(moods)}</pre>
    </main>
  )
}
