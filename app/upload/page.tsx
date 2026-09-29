'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MAX_FILES, uploadZzal, type Draft } from '@/lib/api'
import { MEMBERS } from '@/lib/members'
import { useSession } from '@/lib/useSession'
import { Header } from '@/components/Header'
import { Login } from '@/components/Login'
import { TagInput } from '@/components/TagInput'

export default function UploadPage() {
  const session = useSession()
  const router = useRouter()

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function pick(files: FileList | null) {
    if (!files?.length) return
    setError(
      files.length > MAX_FILES
        ? `한 번에 ${MAX_FILES}개까지. 앞 ${MAX_FILES}개만 담았습니다.`
        : '',
    )
    setDrafts(
      [...files]
        .slice(0, MAX_FILES)
        .map(file => ({ file, members: [], caption: '', moods: [] })),
    )
  }

  function edit(index: number, patch: Partial<Draft>) {
    setDrafts(d => d.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)))
  }

  async function save() {
    setBusy(true)
    setError('')

    const results = await Promise.allSettled(drafts.map(uploadZzal))
    const failed = results.flatMap((r, i) =>
      r.status === 'rejected' ? [`${drafts[i].file.name}: ${r.reason.message}`] : [],
    )

    setBusy(false)
    if (failed.length === 0) {
      router.push('/')
      return
    }
    // Keep only what failed, so a retry does not re-upload what already landed.
    setError(failed.join('\n'))
    setDrafts(drafts.filter((_, i) => results[i].status === 'rejected'))
  }

  if (session === undefined) return null
  if (session === null) return <Login notice="짤을 올리려면 로그인이 필요합니다." />

  return (
    <>
      <Header />
      <main>
        <h2>짤 올리기</h2>

        <label className="picker">
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            onChange={e => pick(e.target.files)}
          />
          <span>이미지 선택 (최대 {MAX_FILES}개)</span>
        </label>

        {drafts.map((draft, i) => (
          <article key={draft.file.name + i} className="draft">
            <Preview file={draft.file} />

            <div className="fields">
              <fieldset>
                <legend>멤버</legend>
                {MEMBERS.map(member => (
                  <label key={member}>
                    <input
                      type="checkbox"
                      checked={draft.members.includes(member)}
                      onChange={() =>
                        edit(i, {
                          members: draft.members.includes(member)
                            ? draft.members.filter(m => m !== member)
                            : [...draft.members, member],
                        })
                      }
                    />
                    {member}
                  </label>
                ))}
              </fieldset>

              <label className="field">
                <span>자막</span>
                <input
                  value={draft.caption}
                  onChange={e => edit(i, { caption: e.target.value })}
                />
              </label>

              <div className="field">
                <span>상황 / 감정</span>
                <TagInput values={draft.moods} onChange={moods => edit(i, { moods })} />
              </div>
            </div>
          </article>
        ))}

        {error && <p className="error">{error}</p>}

        {drafts.length > 0 && (
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? '올리는 중…' : `${drafts.length}개 올리기`}
          </button>
        )}
      </main>
    </>
  )
}

function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  // src="" 는 브라우저가 페이지 자신을 다시 받게 만든다. 주소가 생길 때까지 그린다.
  if (!url) return null

  return <img className="preview" src={url} alt="" />
}
