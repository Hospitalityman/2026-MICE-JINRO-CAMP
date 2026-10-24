import { EVENT } from './config'

export type Bindings = { DB: any; ADMIN_PASSWORD?: string }

export const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
export const clean = (s: unknown, max = 100) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** 신청 접수 상태: apply_state = auto | open | closed */
export function applyGate(state: string | null | undefined, now = Date.now()) {
  const s = state || 'auto'
  if (s === 'closed') return { open: false, reason: '신청이 마감되었습니다.' }
  if (s === 'open') return { open: true, reason: '' }
  const end = Date.parse(EVENT.cancelDeadline)
  if (now >= end) return { open: false, reason: '신청 기간이 종료되었습니다.' }
  return { open: true, reason: '' }
}

export const cancelAllowedByDate = (now = Date.now()) => now < Date.parse(EVENT.cancelDeadline)

// ---------- 입력 검증 ----------
export type RegInput = {
  program_id: number
  name: string; phone: string; email: string; school: string
  class_no: number | null; student_no: number | null; grade_pct: number | null
  guardian_name: string; guardian_phone: string
  teacher_name: string; teacher_phone: string
  allergy: string; uniform_ok: number; consent: number
}

export function validateReg(b: any, manual = false): { ok: true; v: RegInput } | { ok: false; error: string; field?: string } {
  const fail = (error: string, field?: string) => ({ ok: false as const, error, field })
  const name = clean(b.name, 30)
  if (name.length < 2) return fail('이름을 정확히 입력해 주세요.', 'name')
  const phone = digits(b.phone)
  if (!/^01[016789]\d{7,8}$/.test(phone)) return fail('휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)', 'phone')
  const school = clean(b.school, 40)
  if (school.length < 2) return fail('소속 중학교명을 입력해 주세요.', 'school')

  const email = clean(b.email, 100)
  if (!manual && !email) return fail('이메일을 입력해 주세요.', 'email')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('이메일 형식이 올바르지 않습니다.', 'email')

  const num = (x: any) => (x === '' || x === null || x === undefined ? null : Number(x))
  const class_no = num(b.class_no), student_no = num(b.student_no), grade_pct = num(b.grade_pct)
  const guardian_name = clean(b.guardian_name, 30), guardian_phone = digits(b.guardian_phone)
  const teacher_name = clean(b.teacher_name, 30), teacher_phone = digits(b.teacher_phone)

  if (!manual) {
    if (class_no === null || !Number.isInteger(class_no) || class_no < 1 || class_no > 40) return fail('반을 숫자로 입력해 주세요. (1~40)', 'class_no')
    if (student_no === null || !Number.isInteger(student_no) || student_no < 1 || student_no > 60) return fail('번호를 숫자로 입력해 주세요. (1~60)', 'student_no')
    if (grade_pct === null || !Number.isFinite(grade_pct) || grade_pct <= 0 || grade_pct > 100) return fail('예상 내신성적을 0~100 사이의 % 숫자로 입력해 주세요.', 'grade_pct')
    if (guardian_name.length < 2) return fail('보호자 성함을 입력해 주세요.', 'guardian_name')
    if (guardian_phone.length < 9 || guardian_phone.length > 11) return fail('보호자 연락처를 정확히 입력해 주세요.', 'guardian_phone')
    if (teacher_name.length < 2) return fail('중학교 담임(진로) 교사 성함을 입력해 주세요.', 'teacher_name')
    if (teacher_phone.length < 8 || teacher_phone.length > 11) return fail('담임(진로) 교사 연락처를 정확히 입력해 주세요.', 'teacher_phone')
    if (!b.uniform_ok) return fail('교복 착용 안내를 확인해 주세요.', 'uniform_ok')
    if (!b.consent) return fail('개인정보 수집·이용에 동의해 주세요.', 'consent')
  } else {
    if (class_no !== null && (!Number.isInteger(class_no) || class_no < 1 || class_no > 40)) return fail('반은 1~40 숫자로 입력해 주세요.', 'class_no')
    if (student_no !== null && (!Number.isInteger(student_no) || student_no < 1 || student_no > 60)) return fail('번호는 1~60 숫자로 입력해 주세요.', 'student_no')
    if (grade_pct !== null && (!Number.isFinite(grade_pct) || grade_pct < 0 || grade_pct > 100)) return fail('내신 %는 0~100 사이로 입력해 주세요.', 'grade_pct')
  }

  let allergy = ''
  if (b.allergy_has) {
    allergy = clean(b.allergy, 200)
    if (!allergy) return fail('알레르기 항목(예: 땅콩, 우유)을 입력해 주세요.', 'allergy')
  }

  return {
    ok: true,
    v: {
      program_id: Number(b.program_id),
      name, phone, email, school, class_no, student_no, grade_pct,
      guardian_name, guardian_phone, teacher_name, teacher_phone,
      allergy, uniform_ok: b.uniform_ok ? 1 : 0, consent: b.consent ? 1 : 0,
    },
  }
}

// ---------- 관리자 세션(HMAC 서명 쿠키) ----------
const enc = new TextEncoder()
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  u.forEach((x) => (s += String.fromCharCode(x)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)))
}
export const adminPassword = (env: Bindings) => env.ADMIN_PASSWORD || ''

export async function makeToken(env: Bindings, ttlSec = 60 * 60 * 12) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const payload = `admin.${exp}`
  return `${payload}.${await hmac('sess:' + adminPassword(env), payload)}`
}
export async function verifyToken(env: Bindings, token: string | undefined) {
  if (!token || !adminPassword(env)) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const payload = `${parts[0]}.${parts[1]}`
  const sig = await hmac('sess:' + adminPassword(env), payload)
  if (!safeEqual(sig, parts[2])) return false
  return parts[0] === 'admin' && Number(parts[1]) > Math.floor(Date.now() / 1000)
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
