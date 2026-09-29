import { AwsClient } from 'aws4fetch'
import { createClient } from '@supabase/supabase-js'

// The client is not trusted to name the extension: it picks from this map or is rejected.
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const EXPIRES_SECONDS = 60

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { mime } = await req.json()
  const extension = EXTENSIONS[mime]
  if (!extension) return new Response('지원하지 않는 이미지 형식', { status: 400 })

  const key = `${user.id}/${crypto.randomUUID()}.${extension}`

  const r2 = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  })

  const target =
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` +
    `/${process.env.R2_BUCKET}/${key}?X-Amz-Expires=${EXPIRES_SECONDS}`

  // Signing content-type pins it, so the URL cannot be reused to upload something else.
  const signed = await r2.sign(
    new Request(target, { method: 'PUT', headers: { 'content-type': mime } }),
    { aws: { signQuery: true, allHeaders: true } },
  )

  return Response.json({ uploadUrl: signed.url, key })
}
