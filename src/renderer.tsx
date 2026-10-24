import { jsxRenderer } from 'hono/jsx-renderer'
import { EVENT } from './config'

export const renderer = jsxRenderer(({ children, title }: any) => {
  const t = title ? `${title} | ${EVENT.title}` : `${EVENT.title} 신청`
  return (
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#5e2a57" />
        <title>{t}</title>
        <meta name="description" content={`${EVENT.title} — ${EVENT.slogan} 중학교 3학년 대상 신청 페이지`} />
        <meta property="og:title" content={`${EVENT.title} 신청`} />
        <meta property="og:description" content={`${EVENT.slogan} | ${EVENT.date} | ${EVENT.fee}`} />
        <meta property="og:image" content="/static/logo.png" />
        <link rel="icon" href="/static/logo.png" />
        <link href="/static/style.css?v=3" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
})
