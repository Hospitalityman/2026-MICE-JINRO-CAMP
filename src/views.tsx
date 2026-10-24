import { EVENT, SESSIONS, DEPTS } from './config'

export const Header = ({ active }: { active?: string }) => (
  <header class="hdr">
    <div class="wrap">
      <a href="/" aria-label="홈"><img src="/static/logo.png" alt="부산관광고등학교 로고" /></a>
      <div class="org">부산관광고등학교<small>특성화운영부 · MICE 진로캠프</small></div>
      <nav aria-label="주요 메뉴">
        <a href="/apply" class={active === 'apply' ? 'on' : ''}>신청하기</a>
        <a href="/check" class={active === 'check' ? 'on' : ''}>조회·취소</a>
      </nav>
    </div>
  </header>
)

export const Footer = () => (
  <footer class="foot">
    <div class="wrap">
      <p><img src="/static/logo.png" alt="" /><b>{EVENT.org}</b></p>
      <p>문의: <a href={`tel:${EVENT.contact.replace(/\D/g, '')}`}>{EVENT.contact}</a> ({EVENT.teacher})</p>
      <p><a href="/admin" style="font-weight:500;opacity:.55">관리자</a></p>
    </div>
  </footer>
)

export const Privacy = () => (
  <div class="privacy" id="privacy-box" tabindex={0}>
    <h4>개인정보 수집·이용 안내</h4>
    <ul>
      <li><b>수집 목적</b>: 진로캠프 참가 신청 접수, 정원 관리 및 안내, 출석 확인, 시식·시음 알레르기 안전 관리, 행사 후 소속 중학교 공문 발송</li>
      <li><b>수집 항목</b>: 이름, 휴대폰 번호, 이메일, 소속 중학교, 반·번호, 예상 내신성적, 보호자 성함·연락처, 담임(진로) 교사 성함·연락처, 식품 알레르기 정보</li>
      <li><b>보유 기간</b>: 행사 종료 및 공문 발송 완료 후 목적 달성 시까지 보관 후 파기</li>
      <li><b>동의 거부 권리</b>: 동의를 거부할 수 있으나, 동의하지 않으면 신청이 제한됩니다.</li>
      <li>만 14세 미만 아동의 경우 법정대리인의 동의가 필요합니다. (중학교 3학년은 보호자와 함께 확인해 주세요.)</li>
    </ul>
  </div>
)

export const GoCards = () => (
  <div class="go3">
    <div class="go eat"><div class="ic" aria-hidden="true">🍪</div><div><b class="gt"><em>먹 GO!</em> <span class="nw">시식·시음</span></b><span class="min">실습실 투어 중</span><p>실습실별 빵·음식·음료를 직접 맛보고 마셔 보세요. (불가한 실습실은 체험 활동으로 운영)</p></div></div>
    <div class="go see"><div class="ic" aria-hidden="true">👀</div><div><b class="gt"><em>보 GO!</em> <span class="nw">실습실 투어</span></b><span class="min">45분</span><p>홍보대사 선배와 함께 학과 실습실을 돌아보고 간단한 시연을 구경해요.</p></div></div>
    <div class="go hear"><div class="ic" aria-hidden="true">👂</div><div><b class="gt"><em>듣 GO!</em> <span class="nw">학과 상담</span></b><span class="min">45분</span><p>2027학년도 입시 정보, 면접 꿀팁을 듣고 만족도 설문으로 마무리해요.</p></div></div>
  </div>
)

export const Flow = () => (
  <ol class="flow">
    <li><b>① 등록</b>30분<br /><span>{EVENT.regPlace}</span></li>
    <li><b>② 집합·일정 설명</b>15분<br /><span>{EVENT.gatherPlace}</span></li>
    <li><b>③ 실습실 투어</b>45분<br /><span>보 GO · 먹 GO</span></li>
    <li><b>④ 학과 상담</b>45분<br /><span>듣 GO · 입시·면접·설문</span></li>
  </ol>
)

export const ScheduleTable = () => (
  <div class="card" style="padding:6px 12px">
    <dl class="info">
      {[1, 2, 3].map((n) => (
        <div>
          <dt>{SESSIONS[n].label}</dt>
          <dd><b>{SESSIONS[n].prog}</b><br /><span class="mini">등록 {SESSIONS[n].reg} ({EVENT.regPlace})</span></dd>
        </div>
      ))}
      <div>
        <dt>상담 장소</dt>
        <dd>{DEPTS.tour.name}: <b>{DEPTS.tour.counsel}</b><br />{DEPTS.cook.name}: <b>{DEPTS.cook.counsel}</b></dd>
      </div>
    </dl>
  </div>
)
