// Browsers only accept image/png on the clipboard, so anything else is re-encoded.
// A GIF loses its animation here: createImageBitmap gives us the first frame only,
// and no browser can put an animated GIF on the clipboard at all.
const PNG = 'image/png'

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === PNG) return blob

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))),
      PNG,
    ),
  )
}

export async function copyImage(url: string) {
  // Safari drops the clipboard permission if we await before write(), so it gets a
  // pending promise instead of a resolved blob.
  const png = fetch(url)
    .then(r => r.blob())
    .then(toPng)

  await navigator.clipboard.write([new ClipboardItem({ [PNG]: png })])
}

export async function downloadImage(url: string, filename: string) {
  const blob = await fetch(url).then(r => r.blob())
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}
