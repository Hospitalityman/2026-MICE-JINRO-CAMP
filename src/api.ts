import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { Bindings, clean, digits, applyGate, cancelAllowedByDate, validateReg, makeToken, verifyToken, adminPassword, safeEqual } from './lib'
import { EVENT } from './config'

type Env = { Bindings: Bindings }
export const api = new Hono<Env>()

api.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

const nowIso = () => new Date().toISOString()
const normName = (s: unknown) => clean(s, 30).replace(/\s+/g, '')

async function getSetting(db: any, key: string) {
  const r = await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()
  return r?.value as string | undefined
}

async function listPrograms(db: any) {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.session, p.dept, p.capacity, p.status,
        (SELECT COUNT(*) FROM registrations r WHERE r.program_id=p.id AND r.status='confirmed') AS confirmed,
        (SELECT COUNT(*) FROM registrations r WHERE r.program_id=p.id AND r.status='waiting') AS waiting,
        (SELECT COUNT(*) FROM registrations r WHERE r.program_id=p.id AND r.status='cancelled') AS cancelled,
        (SELECT COUNT(*) FROM registrations r WHERE r.program_id=p.id AND r.status='confirmed' AND r.attended=1) AS attended
       FROM programs p ORDER BY p.session, CASE p.dept WHEN 'tour' THEN 0 ELSE 1 END`
    )
    .all()
  return results as any[]
}

/** 대기자 자동 승격: 자리가 있고 프로그램이 open일 때, 대기 1번부터 순서대로 확정 */
async function promoteWaiting(db: any, programId: number) {
  let promoted = 0
  for (let i = 0; i < 200; i++) {
    const r = await db
      .prepare(
        `UPDATE registrations SET status='confirmed', promoted_at=?
         WHERE id=(SELECT id FROM registrations WHERE program_id=? AND status='waiting' ORDER BY id LIMIT 1)
           AND (SELECT COUNT(*) FROM registrations WHERE program_id=? AND status='confirmed')
               < (SELECT capacity FROM programs WHERE id=? AND status='open')`
      )
      .bind(nowIso(), programId, programId, programId)
      .run()
    if (!r.meta.changes) break
    promoted++
  }
  return promoted
}

async function waitingPosition(db: any, reg: { id: number; program_id: number }) {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM registrations WHERE program_id=? AND status='waiting' AND id<=?`)
    .bind(reg.program_id, reg.id)
    .first()
  return r?.n as number
}

// ================= 공개 API =================
api.get('/programs', async (c) => {
  const db = c.env.DB
  const [programs, state] = await Promise.all([listPrograms(db), getSetting(db, 'apply_state')])
  const gate = applyGate(state)
  return c.json({
    programs: programs.map((p) => ({
      id: p.id, session: p.session, dept: p.dept, capacity: p.capacity, status: p.status,
      confirmed: p.confirmed, waiting: p.waiting,
    })),
    gate,
    cancelAllowed: cancelAllowedByDate(),
  })
})

api.post('/register', async (c) => {
  const db = c.env.DB
  let body: any
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: '잘못된 요청입니다.' }, 400) }

  const gate = applyGate(await getSetting(db, 'apply_state'))
  if (!gate.open) return c.json({ ok: false, error: gate.reason, code: 'CLOSED' }, 403)

  const val = validateReg(body)
  if (!val.ok) return c.json(val, 400)
  const v = val.v
  v.name = normName(v.name)

  const prog = await db.prepare('SELECT * FROM programs WHERE id=?').bind(v.program_id).first()
  if (!prog) return c.json({ ok: false, error: '신청할 차시·학과를 선택해 주세요.', field: 'program_id' }, 400)
  if (prog.status === 'cancelled') return c.json({ ok: false, error: '폐강된 프로그램입니다. 다른 차시·학과를 선택해 주세요.', code: 'PROGRAM_CANCELLED' }, 409)
  if (prog.status === 'closed') return c.json({ ok: false, error: '신청이 마감된 프로그램입니다. 다른 차시·학과를 선택해 주세요.', code: 'PROGRAM_CLOSED' }, 409)

  // 중복 사전 확인 (최종 보장은 DB 유니크 인덱스)
  const dup = await db
    .prepare(`SELECT r.id, r.status, r.program_id, p.session, p.dept FROM registrations r JOIN programs p ON p.id=r.program_id
              WHERE r.name=? AND r.phone=? AND r.status IN ('confirmed','waiting')`)
    .bind(v.name, v.phone).first()
  if (dup) return c.json({ ok: false, error: '이미 신청된 내역이 있습니다. 1인 1회(한 차시·한 학과)만 신청할 수 있습니다. 「신청 조회·취소」에서 확인해 주세요.', code: 'DUPLICATE' }, 409)

  // 정원 판단과 INSERT를 한 SQL 문장으로 처리 → 동시 신청에서도 정원 초과 없음
  let res: any
  try {
    res = await db
      .prepare(
        `INSERT INTO registrations
          (program_id,name,phone,email,school,grade,class_no,student_no,grade_pct,guardian_name,guardian_phone,
           teacher_name,teacher_phone,allergy,uniform_ok,consent,status,created_at)
         SELECT ?,?,?,?,?,3,?,?,?,?,?,?,?,?,?,?,
           CASE WHEN (SELECT COUNT(*) FROM registrations WHERE program_id=? AND status='confirmed')
                     < (SELECT capacity FROM programs WHERE id=?)
                 AND NOT EXISTS (SELECT 1 FROM registrations WHERE program_id=? AND status='waiting')
                THEN 'confirmed' ELSE 'waiting' END,
           ?
         WHERE EXISTS (SELECT 1 FROM programs WHERE id=? AND status='open')`
      )
      .bind(v.program_id, v.name, v.phone, v.email, v.school, v.class_no, v.student_no, v.grade_pct,
        v.guardian_name, v.guardian_phone, v.teacher_name, v.teacher_phone, v.allergy, v.uniform_ok, v.consent,
        v.program_id, v.program_id, v.program_id, nowIso(), v.program_id)
      .run()
  } catch (e: any) {
    if (String(e?.message || e).includes('UNIQUE')) {
      return c.json({ ok: false, error: '이미 신청된 내역이 있습니다. 1인 1회만 신청할 수 있습니다.', code: 'DUPLICATE' }, 409)
    }
    throw e
  }
  if (!res.meta.changes) return c.json({ ok: false, error: '방금 신청이 마감되었습니다. 다른 차시·학과를 선택해 주세요.', code: 'PROGRAM_CLOSED' }, 409)

  const reg = await db.prepare('SELECT id, program_id, status FROM registrations WHERE id=?').bind(res.meta.last_row_id).first()
  const pos = reg.status === 'waiting' ? await waitingPosition(db, reg) : 0
  return c.json({ ok: true, status: reg.status, waitingNo: pos, session: prog.session, dept: prog.dept, name: v.name })
})

// 조회: 이름 + 휴대폰
api.post('/lookup', async (c) => {
  const db = c.env.DB
  const b: any = await c.req.json().catch(() => ({}))
  const name = normName(b.name), phone = digits(b.phone)
  if (name.length < 2 || phone.length < 9) return c.json({ ok: false, error: '이름과 휴대폰 번호를 정확히 입력해 주세요.' }, 400)
  const { results } = await db
    .prepare(`SELECT r.id, r.program_id, r.status, r.school, r.created_at, r.promoted_at, p.session, p.dept, p.status AS pstatus
              FROM registrations r JOIN programs p ON p.id=r.program_id
              WHERE r.name=? AND r.phone=? AND r.status IN ('confirmed','waiting') ORDER BY r.id DESC`)
    .bind(name, phone).all()
  const items = []
  for (const r of results as any[]) {
    items.push({
      id: r.id, status: r.status, session: r.session, dept: r.dept, school: r.school, created_at: r.created_at,
      promoted: !!r.promoted_at,
      waitingNo: r.status === 'waiting' ? await waitingPosition(db, r) : 0,
      programStatus: r.pstatus,
    })
  }
  return c.json({ ok: true, items, cancelAllowed: cancelAllowedByDate(), deadline: EVENT.cancelDeadlineText })
})

api.post('/cancel', async (c) => {
  const db = c.env.DB
  const b: any = await c.req.json().catch(() => ({}))
  const name = normName(b.name), phone = digits(b.phone), id = Number(b.id)
  if (!cancelAllowedByDate()) return c.json({ ok: false, error: `셀프 취소는 ${EVENT.cancelDeadlineText}까지만 가능합니다. 문의: ${EVENT.contact}` }, 403)
  const reg = await db
    .prepare(`SELECT r.id, r.program_id, r.status, p.status AS pstatus FROM registrations r JOIN programs p ON p.id=r.program_id
              WHERE r.id=? AND r.name=? AND r.phone=?`)
    .bind(id, name, phone).first()
  if (!reg || reg.status === 'cancelled') return c.json({ ok: false, error: '취소할 신청 내역을 찾을 수 없습니다.' }, 404)
  if (reg.pstatus === 'closed') return c.json({ ok: false, error: `인원이 확정(마감)된 프로그램은 취소할 수 없습니다. 문의: ${EVENT.contact}` }, 403)
  const r = await db
    .prepare(`UPDATE registrations SET status='cancelled', cancelled_at=?, cancelled_by='self' WHERE id=? AND status IN ('confirmed','waiting')`)
    .bind(nowIso(), id).run()
  if (r.meta.changes && reg.status === 'confirmed') await promoteWaiting(db, reg.program_id)
  return c.json({ ok: true })
})

// ================= 관리자 API =================
api.post('/admin/login', async (c) => {
  const db = c.env.DB
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local'
  const now = Math.floor(Date.now() / 1000)
  const f = await db.prepare('SELECT count,last_at FROM login_fail WHERE ip=?').bind(ip).first()
  if (f && f.count >= 5 && now - f.last_at < 600) {
    return c.json({ ok: false, error: '로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요.' }, 429)
  }
  const b: any = await c.req.json().catch(() => ({}))
  if (!adminPassword(c.env)) return c.json({ ok: false, error: '관리자 비밀번호가 서버에 설정되지 않았습니다.' }, 503)
  if (!safeEqual(String(b.password ?? ''), adminPassword(c.env))) {
    await db.prepare(`INSERT INTO login_fail(ip,count,last_at) VALUES(?,1,?)
      ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN ?-last_at>=600 THEN 1 ELSE count+1 END, last_at=?`)
      .bind(ip, now, now, now).run()
    return c.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, 401)
  }
  await db.prepare('DELETE FROM login_fail WHERE ip=?').bind(ip).run()
  const secure = c.req.url.startsWith('https') || c.req.header('x-forwarded-proto') === 'https'
  setCookie(c, 'adm', await makeToken(c.env), { httpOnly: true, sameSite: 'Strict', secure, path: '/', maxAge: 60 * 60 * 12 })
  return c.json({ ok: true })
})

api.post('/admin/logout', (c) => {
  deleteCookie(c, 'adm', { path: '/' })
  return c.json({ ok: true })
})

api.get('/admin-session', async (c) => c.json({ ok: await verifyToken(c.env, getCookie(c, 'adm')) }))

const admin = new Hono<Env>()
admin.use('*', async (c, next) => {
  if (!(await verifyToken(c.env, getCookie(c, 'adm')))) return c.json({ ok: false, error: '관리자 로그인이 필요합니다.', code: 'AUTH' }, 401)
  await next()
})


admin.get('/overview', async (c) => {
  const db = c.env.DB
  const state = (await getSetting(db, 'apply_state')) || 'auto'
  return c.json({ ok: true, programs: await listPrograms(db), applyState: state, gate: applyGate(state) })
})

admin.put('/apply-state', async (c) => {
  const b: any = await c.req.json().catch(() => ({}))
  if (!['auto', 'open', 'closed'].includes(b.state)) return c.json({ ok: false, error: '잘못된 값입니다.' }, 400)
  await c.env.DB.prepare(`INSERT INTO settings(key,value) VALUES('apply_state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(b.state).run()
  return c.json({ ok: true })
})

admin.put('/programs/:id', async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  const b: any = await c.req.json().catch(() => ({}))
  const prog = await db.prepare('SELECT * FROM programs WHERE id=?').bind(id).first()
  if (!prog) return c.json({ ok: false, error: '프로그램을 찾을 수 없습니다.' }, 404)
  let cap = prog.capacity, st = prog.status
  if (b.capacity !== undefined) {
    cap = Number(b.capacity)
    if (!Number.isInteger(cap) || cap < 0 || cap > 500) return c.json({ ok: false, error: '정원은 0~500 사이의 정수여야 합니다.' }, 400)
  }
  if (b.status !== undefined) {
    if (!['open', 'cancelled', 'closed'].includes(b.status)) return c.json({ ok: false, error: '잘못된 상태입니다.' }, 400)
    st = b.status
  }
  await db.prepare('UPDATE programs SET capacity=?, status=? WHERE id=?').bind(cap, st, id).run()
  const promoted = await promoteWaiting(db, id) // 정원 증가·재개방 시 대기자 승격
  return c.json({ ok: true, promoted })
})

admin.get('/registrations', async (c) => {
  const db = c.env.DB
  const programId = Number(c.req.query('program_id') || 0)
  const status = c.req.query('status') || ''
  const q = clean(c.req.query('q') || '', 50)
  const where: string[] = [], binds: any[] = []
  if (programId) { where.push('r.program_id=?'); binds.push(programId) }
  if (status && status !== 'all') { where.push('r.status=?'); binds.push(status) }
  if (q) {
    const qd = digits(q)
    const parts = ['r.name LIKE ?', 'r.school LIKE ?']
    binds.push(`%${q.replace(/\s+/g, '')}%`, `%${q}%`)
    if (qd.length >= 2) { parts.push('r.phone LIKE ?', 'r.guardian_phone LIKE ?'); binds.push(`%${qd}%`, `%${qd}%`) }
    where.push('(' + parts.join(' OR ') + ')')
  }
  const { results } = await db
    .prepare(`SELECT r.*, p.session, p.dept FROM registrations r JOIN programs p ON p.id=r.program_id
              ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
              ORDER BY p.session, p.dept DESC, CASE r.status WHEN 'confirmed' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, r.id LIMIT 3000`)
    .bind(...binds).all()
  return c.json({ ok: true, items: results })
})

admin.post('/registrations', async (c) => {
  const db = c.env.DB
  const b: any = await c.req.json().catch(() => ({}))
  const val = validateReg(b, true)
  if (!val.ok) return c.json(val, 400)
  const v = val.v
  v.name = normName(v.name)
  const prog = await db.prepare('SELECT id FROM programs WHERE id=?').bind(v.program_id).first()
  if (!prog) return c.json({ ok: false, error: '차시·학과를 선택해 주세요.' }, 400)
  try {
    await db.prepare(
      `INSERT INTO registrations (program_id,name,phone,email,school,grade,class_no,student_no,grade_pct,guardian_name,guardian_phone,
        teacher_name,teacher_phone,allergy,uniform_ok,consent,status,is_manual,created_at)
       VALUES (?,?,?,?,?,3,?,?,?,?,?,?,?,?,?,?,'confirmed',1,?)`)
      .bind(v.program_id, v.name, v.phone, v.email, v.school, v.class_no, v.student_no, v.grade_pct, v.guardian_name, v.guardian_phone,
        v.teacher_name, v.teacher_phone, v.allergy, v.uniform_ok, v.consent, nowIso()).run()
  } catch (e: any) {
    if (String(e?.message || e).includes('UNIQUE')) return c.json({ ok: false, error: '같은 이름·휴대폰으로 이미 신청된 내역이 있습니다.' }, 409)
    throw e
  }
  return c.json({ ok: true })
})

admin.post('/registrations/:id/cancel', async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  const reg = await db.prepare('SELECT id, program_id, status FROM registrations WHERE id=?').bind(id).first()
  if (!reg || reg.status === 'cancelled') return c.json({ ok: false, error: '이미 취소되었거나 없는 신청입니다.' }, 404)
  await db.prepare(`UPDATE registrations SET status='cancelled', cancelled_at=?, cancelled_by='admin' WHERE id=?`).bind(nowIso(), id).run()
  const promoted = reg.status === 'confirmed' ? await promoteWaiting(db, reg.program_id) : 0
  return c.json({ ok: true, promoted })
})

// 대기자 수동 확정(정원 무관)
admin.post('/registrations/:id/confirm', async (c) => {
  const id = Number(c.req.param('id'))
  const r = await c.env.DB.prepare(`UPDATE registrations SET status='confirmed', promoted_at=? WHERE id=? AND status='waiting'`).bind(nowIso(), id).run()
  return c.json({ ok: !!r.meta.changes })
})

admin.post('/registrations/:id/attend', async (c) => {
  const id = Number(c.req.param('id'))
  const b: any = await c.req.json().catch(() => ({}))
  const on = b.attended ? 1 : 0
  const r = await c.env.DB.prepare(`UPDATE registrations SET attended=?, attended_at=? WHERE id=? AND status='confirmed'`)
    .bind(on, on ? nowIso() : null, id).run()
  return c.json({ ok: !!r.meta.changes })
})

api.route('/admin', admin)
