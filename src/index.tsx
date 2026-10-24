import { Hono } from 'hono'
import { renderer } from './renderer'
import { api } from './api'
import { EVENT, SESSIONS, DEPTS } from './config'
import { Header, Footer, Privacy, GoCards, Flow, ScheduleTable } from './views'
import type { Bindings } from './lib'

const app = new Hono<{ Bindings: Bindings }>()

app.route('/api', api)
app.use(renderer)

// ---------- 메인 ----------
app.get('/', (c) =>
  c.render(
    <>
      <Header />
      <section class="hero" id="hero-section">
        <div class="wrap">
          <span class="tag">🍁 {EVENT.target} 대상 · {EVENT.fee}</span>
          <h1>{EVENT.title}</h1>
          <div class="slogan">{EVENT.slogan}</div>
          <p>{EVENT.tagline}</p>
        </div>
      </section>

      <main class="wrap">
        <section class="card pull" id="event-info">
          <dl class="info">
            <div><dt>일시</dt><dd><b>{EVENT.date}</b> · 총 3차시<br /><span class="mini">1차 13:00~14:45 / 2차 15:00~16:45 / 3차 17:00~18:45</span></dd></div>
            <div><dt>장소</dt><dd>{EVENT.place}</dd></div>
            <div><dt>대상</dt><dd>{EVENT.target}</dd></div>
            <div><dt>참가비</dt><dd><span class="free">무료</span></dd></div>
            <div><dt>준비물</dt><dd>👔 {EVENT.uniform}</dd></div>
            <div><dt>정원</dt><dd>차시별 MICE관광과 30명 · MICE외식조리과 30명 (선착순)</dd></div>
            <div><dt>신청기간</dt><dd>{EVENT.applyPeriodText}</dd></div>
            <div><dt>문의</dt><dd><a href={`tel:${EVENT.contact.replace(/\D/g, '')}`}><b>{EVENT.contact}</b></a></dd></div>
          </dl>
          <p class="notice-line" id="attend-notice">📌 현장 출석확인증은 분실 우려가 있어 발급하지 않으며, 행사 종료 후 소속 중학교로 참가자 명단 확인 공문을 발송해 드립니다.</p>
        </section>

        <section class="sec" id="cta-section">
          <div id="gate-msg"></div>
          <div class="cta-box">
            <a class="btn btn-primary" href="/apply" id="apply-btn">📝 신청하러 가기</a>
            <p style="margin:10px 0 0"><a class="btn btn-line btn-sm" href="/check">신청 조회 · 취소</a></p>
          </div>
        </section>

        <section class="sec" id="go-section">
          <h2>✨ 이런 걸 해요</h2>
          <GoCards />
        </section>

        <section class="sec" id="flow-section">
          <h2>🕐 진행 순서 <span class="mini">(모든 차시 동일)</span></h2>
          <Flow />
        </section>

        <section class="sec" id="schedule-section">
          <h2>📅 차시별 시간·장소</h2>
          <ScheduleTable />
        </section>

        <section class="sec" id="status-section">
          <h2>🔥 실시간 신청 현황</h2>
          <div class="card" id="status-box"><div class="mini">불러오는 중…</div></div>
          <p class="mini">정원이 차면 대기 접수되며, 취소가 생기면 대기 순번대로 자동 확정됩니다.</p>
        </section>

        <section class="sec" id="notice-section">
          <h2>📌 유의 사항</h2>
          <div class="card">
            <ul style="margin:0;padding-left:18px;font-size:.9rem">
              <li>1인 1회(한 차시 · 한 학과)만 신청할 수 있습니다.</li>
              <li>등록은 각 차시 시작 30분 전부터 <b>{EVENT.regPlace}</b>에서 진행됩니다.</li>
              <li>시식·시음이 있으니 <b>식품 알레르기</b>가 있으면 신청서에 꼭 적어 주세요.</li>
              <li>셀프 취소는 {EVENT.cancelDeadlineText}까지 이름·휴대폰 번호로 조회 후 가능합니다.</li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
      <script src="/static/common.js?v=1"></script>
      <script src="/static/home.js?v=1"></script>
    </>,
    { title: undefined }
  )
)

// ---------- 신청 ----------
app.get('/apply', (c) =>
  c.render(
    <>
      <Header active="apply" />
      <main class="wrap" style="padding-top:18px">
        <h1 style="font-size:1.35rem;color:var(--plum);margin:0 0 4px">📝 참가 신청</h1>
        <p class="mini" style="margin:0 0 6px">{EVENT.dateShort} · {EVENT.target} · 1인 1회 신청 · 참가비 {EVENT.fee}</p>
        <div id="gate-msg"></div>

        <form id="apply-form" novalidate autocomplete="on">
          <section id="sec-slot">
            <label class="f">1. 차시 · 학과 선택 <span class="req">*</span></label>
            <div class="help" style="margin:-2px 0 8px">원하는 차시에서 학과 한 곳을 골라 주세요. 정원이 차면 <b>대기</b>로 접수됩니다.</div>
            <div class="slot" id="slot-list"><div class="mini">현황 불러오는 중…</div></div>
            <div id="slot-pick" class="alert al-info hide"></div>
          </section>

          <section id="sec-student">
            <label class="f" for="name">2. 이름 <span class="req">*</span></label>
            <input type="text" id="name" name="name" autocomplete="name" maxlength="30" placeholder="홍길동" />

            <label class="f" for="phone">휴대폰 번호 <span class="req">*</span></label>
            <input type="tel" id="phone" name="phone" inputmode="numeric" autocomplete="tel" maxlength="13" placeholder="010-0000-0000" />

            <label class="f" for="email">이메일 <span class="req">*</span></label>
            <input type="email" id="email" name="email" autocomplete="email" maxlength="100" placeholder="example@email.com" />

            <label class="f" for="school">소속 중학교명 <span class="req">*</span></label>
            <input type="text" id="school" name="school" maxlength="40" placeholder="예: 부산중학교" />

            <label class="f">학년 / 반 / 번호 <span class="req">*</span></label>
            <div class="row2" style="grid-template-columns:.8fr 1fr 1fr">
              <input type="text" value="3학년" disabled aria-label="학년(3학년 고정)" style="background:#f3ebdd;font-weight:800;text-align:center" />
              <div class="pct"><input type="number" id="class_no" name="class_no" inputmode="numeric" min="1" max="40" placeholder="반" aria-label="반" /><span>반</span></div>
              <div class="pct"><input type="number" id="student_no" name="student_no" inputmode="numeric" min="1" max="60" placeholder="번호" aria-label="번호" /><span>번</span></div>
            </div>

            <label class="f" for="grade_pct">본인 예상 내신성적 <span class="req">*</span></label>
            <div class="pct"><input type="number" id="grade_pct" name="grade_pct" inputmode="decimal" step="0.1" min="0.1" max="100" placeholder="예: 25" /><span>% (상위)</span></div>
            <div class="help">전교(또는 학년) 석차 기준 <b>상위 몇 %</b>인지 숫자만 입력해 주세요. (예: 상위 25% → 25)</div>
          </section>

          <section id="sec-guardian">
            <label class="f" for="guardian_name">3. 보호자 성함 <span class="req">*</span></label>
            <input type="text" id="guardian_name" name="guardian_name" maxlength="30" />
            <label class="f" for="guardian_phone">보호자 연락처 <span class="req">*</span></label>
            <input type="tel" id="guardian_phone" name="guardian_phone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" />

            <label class="f" for="teacher_name">중학교 담임(진로) 교사 성함 <span class="req">*</span></label>
            <input type="text" id="teacher_name" name="teacher_name" maxlength="30" />
            <label class="f" for="teacher_phone">담임(진로) 교사 연락처 <span class="req">*</span></label>
            <input type="tel" id="teacher_phone" name="teacher_phone" inputmode="numeric" maxlength="13" placeholder="학교 번호 또는 휴대폰" />
          </section>

          <section id="sec-allergy">
            <label class="f">4. 식품 알레르기 <span class="req">*</span></label>
            <div class="help" style="margin:-2px 0 8px">🍪 실습실마다 빵·음식·음료 시식·시음(먹 GO)이 있어요.</div>
            <div class="seg" role="radiogroup" aria-label="식품 알레르기 여부">
              <label><input type="radio" name="allergy_has" value="0" checked /><span>없음</span></label>
              <label><input type="radio" name="allergy_has" value="1" /><span>있음</span></label>
            </div>
            <div id="allergy-wrap" class="hide">
              <input type="text" id="allergy" name="allergy" maxlength="200" placeholder="예: 땅콩, 우유, 계란, 새우" style="margin-top:8px" />
            </div>
          </section>

          <section id="sec-agree">
            <label class="f">5. 확인 및 동의 <span class="req">*</span></label>
            <label class="chk"><input type="checkbox" id="uniform_ok" name="uniform_ok" /><span><b>[필수]</b> 행사 당일 <b>소속 중학교 교복</b>을 착용하고 참석하겠습니다. (체육복이 교내 규정이면 체육복 가능)</span></label>
            <div style="height:8px"></div>
            <Privacy />
            <label class="chk"><input type="checkbox" id="consent" name="consent" /><span><b>[필수]</b> 개인정보 수집·이용에 동의합니다.</span></label>
          </section>

          <div id="form-err" class="alert al-bad hide" role="alert"></div>
          <div class="sticky-cta">
            <button type="submit" class="btn btn-primary btn-block" id="submit-btn">신청 완료하기</button>
          </div>
        </form>

        <section id="done-box" class="card done hide" aria-live="polite"></section>
      </main>
      <Footer />
      <script src="/static/common.js?v=1"></script>
      <script src="/static/apply.js?v=1"></script>
    </>,
    { title: '참가 신청' }
  )
)

// ---------- 조회/취소 ----------
app.get('/check', (c) =>
  c.render(
    <>
      <Header active="check" />
      <main class="wrap" style="padding-top:18px">
        <h1 style="font-size:1.35rem;color:var(--plum);margin:0 0 4px">🔎 신청 조회 · 취소</h1>
        <p class="mini" style="margin:0 0 10px">신청 시 입력한 이름과 휴대폰 번호로 조회합니다. 셀프 취소는 {EVENT.cancelDeadlineText}까지 가능합니다.</p>
        <form id="lookup-form" class="card" novalidate>
          <label class="f" style="margin-top:0" for="name">이름</label>
          <input type="text" id="name" maxlength="30" autocomplete="name" />
          <label class="f" for="phone">휴대폰 번호</label>
          <input type="tel" id="phone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" autocomplete="tel" />
          <div id="lk-err" class="alert al-bad hide" role="alert"></div>
          <div style="margin-top:16px"><button class="btn btn-plum btn-block" id="lk-btn" type="submit">조회하기</button></div>
        </form>
        <div id="lk-result" aria-live="polite"></div>
      </main>
      <Footer />
      <script src="/static/common.js?v=1"></script>
      <script src="/static/check.js?v=1"></script>
    </>,
    { title: '신청 조회·취소' }
  )
)

// ---------- 관리자 ----------
app.get('/admin', (c) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Robots-Tag', 'noindex, nofollow')
  return c.html(
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>관리자 | ${EVENT.title}</title><link rel="icon" href="/static/logo.png">
<link rel="stylesheet" href="/static/style.css?v=2"><link rel="stylesheet" href="/static/admin.css?v=1"></head>
<body class="adm"><div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script src="/static/common.js?v=1"></script><script src="/static/admin.js?v=1"></script></body></html>`
  )
})

app.notFound((c) => c.render(<><Header /><main class="wrap"><div class="card done"><div class="big">🍂</div><h2>페이지를 찾을 수 없어요</h2><p><a class="btn btn-plum" href="/">홈으로</a></p></div></main></>))

export default app
