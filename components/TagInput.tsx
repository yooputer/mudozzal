'use client'

import { useState } from 'react'

export const MAX_TAG_LENGTH = 16
export const MAX_TAGS = 10

export function TagInput({
  values,
  onChange,
}: {
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [text, setText] = useState('')
  const full = values.length >= MAX_TAGS

  function add() {
    // maxLength 는 IME 조합 중에는 적용되지 않으므로 여기서 한 번 더 자른다.
    const value = text.trim().slice(0, MAX_TAG_LENGTH)
    setText('')
    if (!value || full || values.includes(value)) return
    onChange([...values, value])
  }

  return (
    <div className="tag-input">
      {values.map(value => (
        <button
          type="button"
          key={value}
          className="chip"
          onClick={() => onChange(values.filter(v => v !== value))}
        >
          {value} ✕
        </button>
      ))}
      <input
        value={text}
        disabled={full}
        maxLength={MAX_TAG_LENGTH}
        placeholder={full ? `${MAX_TAGS}개까지` : '입력 후 Enter'}
        onChange={e => setText(e.target.value)}
        onBlur={add}
        onKeyDown={e => {
          // 한글 등 IME 입력 중의 Enter 는 조합을 확정하는 키지 제출 키가 아니다.
          // 여기서 처리하면 조합 중인 값이 태그로 들어가고, 입력칸을 비우는 바람에
          // 남은 글자가 한 번 더 들어오거나 React 의 값 추적이 DOM 과 어긋난다.
          if (e.nativeEvent.isComposing) return

          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
      />
    </div>
  )
}
