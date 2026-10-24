(function () {
  const app = $('#app');
  const ST = { confirmed: ['확정', 'c-ok'], waiting: ['대기', 'c-wt'], cancelled: ['취소', 'c-cx'] };
  const PST = { open: ['접수중', 'b-ok'], cancelled: ['폐강', 'b-off'], closed: ['마감', 'b-off'] };
  let tab = 'dash', programs = [], applyState = 'auto', gate = {};
  let regs = [], filter = { program_id: '', status: 'confirmed', q: '' };
  let ciFilter = { program_id: '', q: '' };

  const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };
  const pLabel = (p) => SESSIONS[p.session].l + ' ' + DEPTS[p.dept].s;
  const kst = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return d.toISOString().slice(0, 16).replace('T', ' '); };

  // ---------- 로그인 ----------
  function loginView(msg) {
    app.innerHTML = '<div class="login"><div class="card" style="text-align:center"><img src="/static/logo.png" width="72" alt=""><h2 style="color:var(--plum);margin:8px 0 2px">관리자 로그인</h2><p class="mini">MICE 진로캠프 신청 관리</p>' +
      (msg ? '<div class="alert al-bad">' + esc(msg) + '</div>' : '') +
      '<form id="lf"><input type="password" id="pw" placeholder="관리자 비밀번호" autocomplete="current-password" inputmode="numeric" style="text-align:center"><div style="height:12px"></div><button class="btn btn-plum btn-block">로그인</button></form><p style="margin-top:14px"><a href="/" class="mini">← 신청 페이지로</a></p></div></div>';
    $('#lf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const j = await api('/admin/login', { body: { password: $('#pw').value } });
      if (j.ok) boot(); else loginView(j.error || '로그인 실패');
    });
    $('#pw').focus();
  }

  // ---------- 공통 프레임 ----------
  function frame() {
    const tabs = [['dash', '📊 현황'], ['list', '📋 신청자'], ['checkin', '✅ 현장 출석'], ['export', '📥 엑셀'], ['qr', '🔗 QR·링크']];
    app.innerHTML = '<div class="top"><div class="in"><img src="/static/logo.png" alt=""><b>MICE 진로캠프 관리자</b><span class="sp"></span><a class="btn btn-sm btn-line" style="min-height:34px;background:#fff" href="/">신청페이지</a><button class="btn btn-sm" id="lo" style="background:#7a3a6e;color:#fff;min-height:34px">로그아웃</button></div></div>' +
      '<div class="tabs"><div class="in">' + tabs.map((t) => '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div></div><main id="body"></main>';
    $('#lo').onclick = async () => { await api('/admin/logout', { method: 'POST', body: {} }); loginView(); };
    $$('.tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; frame(); render(); }));
  }
  async function guard(j) { if (j && j.code === 'AUTH') { loginView('세션이 만료되었습니다. 다시 로그인해 주세요.'); return true; } return false; }

  async function loadOverview() {
    const j = await api('/admin/overview');
    if (await guard(j)) return false;
    programs = j.programs; applyState = j.applyState; gate = j.gate; return true;
  }
  async function loadRegs() {
    const qs = new URLSearchParams();
    if (filter.program_id) qs.set('program_id', filter.program_id);
    qs.set('status', filter.status || 'all');
    if (filter.q) qs.set('q', filter.q);
    const j = await api('/admin/registrations?' + qs);
    if (await guard(j)) return false;
    regs = j.items || []; return true;
  }
  async function allRegs() {
    const j = await api('/admin/registrations?status=all');
    if (await guard(j)) return null; return j.items || [];
  }

  async function render() {
    const body = $('#body');
    body.innerHTML = '<p class="mini">불러오는 중…</p>';
    if (!(await loadOverview())) return;
    if (tab === 'dash') dash(body);
    else if (tab === 'list') { if (await loadRegs()) list(body); }
    else if (tab === 'checkin') { filter2(); }
    else if (tab === 'export') exportView(body);
    else if (tab === 'qr') qrView(body);
  }

  // ---------- 현황 ----------
  function dash(body) {
    const tot = programs.reduce((a, p) => ({ c: a.c + p.confirmed, w: a.w + p.waiting, x: a.x + p.cancelled, a: a.a + p.attended, cap: a.cap + (p.status === 'cancelled' ? 0 : p.capacity) }), { c: 0, w: 0, x: 0, a: 0, cap: 0 });
    const stLabel = { auto: '자동 (기간 기준)', open: '수동 열림', closed: '수동 마감' };
    body.innerHTML =
      '<div class="stat"><div><b>' + tot.c + '</b><span>확정 인원 / 총정원 ' + tot.cap + '</span></div><div><b>' + tot.w + '</b><span>대기 인원</span></div><div><b>' + tot.x + '</b><span>취소 건</span></div><div><b>' + tot.a + '</b><span>현장 출석</span></div></div>' +
      '<div class="card" style="margin-bottom:12px"><b>📢 신청 접수 상태: <span style="color:' + (gate.open ? 'var(--ok)' : 'var(--bad)') + '">' + (gate.open ? '접수 중' : '접수 중지') + '</span></b> <span class="mini">(' + stLabel[applyState] + ')</span>' +
      '<div class="mini" style="margin:4px 0 10px">신청 마감은 수동으로 진행합니다. 「신청 마감」을 누르면 모든 신규 신청이 즉시 차단됩니다. (자동 모드: 10/26 00:00 ~ 11/11 23:59 접수)</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-danger" data-as="closed">⛔ 신청 마감(전체)</button><button class="btn btn-sm btn-plum" data-as="open">▶ 강제 열기</button><button class="btn btn-sm btn-line" data-as="auto">⏱ 자동(기간 기준)</button></div></div>' +
      '<div class="pgrid">' + programs.map((p) => {
        const pst = PST[p.status];
        return '<div class="pc"><div style="display:flex;justify-content:space-between;align-items:center"><h3>' + SESSIONS[p.session].l + ' · ' + DEPTS[p.dept].n + '</h3><span class="badge ' + pst[1] + '">' + pst[0] + '</span></div>' +
          '<div class="mini">' + SESSIONS[p.session].prog + '</div>' +
          '<div class="big">' + p.confirmed + '<small> / ' + p.capacity + '명</small></div>' +
          '<div class="bar"><i class="' + (p.confirmed >= p.capacity ? 'full' : p.confirmed / Math.max(1, p.capacity) >= .8 ? 'hi' : '') + '" style="width:' + Math.min(100, Math.round(p.confirmed / Math.max(1, p.capacity) * 100)) + '%"></i></div>' +
          '<div class="sub"><span>대기 <b>' + p.waiting + '</b></span><span>취소 ' + p.cancelled + '</span><span>출석 ' + p.attended + '</span></div>' +
          '<div class="cap"><label for="cap' + p.id + '">정원</label><input type="number" min="0" max="500" id="cap' + p.id + '" value="' + p.capacity + '"><button class="btn btn-sm btn-plum" data-cap="' + p.id + '">저장</button></div>' +
          '<div class="act">' +
          (p.status === 'open' ? '<button class="btn btn-sm btn-danger" data-st="cancelled" data-id="' + p.id + '">폐강</button><button class="btn btn-sm btn-line" data-st="closed" data-id="' + p.id + '">마감(인원확정)</button>' : '<button class="btn btn-sm btn-primary" data-st="open" data-id="' + p.id + '">접수 재개</button>') +
          '<button class="btn btn-sm btn-line" data-view="' + p.id + '">명단</button><button class="btn btn-sm btn-line" data-add="' + p.id + '">+ 수기추가</button></div>' +
          (p.status === 'cancelled' ? '<div class="mini" style="margin-top:6px">폐강: 신규 신청만 차단됩니다. 기존 신청자는 유지됩니다.</div>' : '') +
          (p.status === 'closed' ? '<div class="mini" style="margin-top:6px">마감: 신규 신청·취소가 모두 차단되었습니다. (인원 확정)</div>' : '') + '</div>';
      }).join('') + '</div>';

    $$('[data-as]').forEach((b) => (b.onclick = async () => {
      const s = b.dataset.as;
      if (s === 'closed' && !confirm('모든 프로그램의 신규 신청을 마감하시겠습니까?')) return;
      const j = await api('/admin/apply-state', { method: 'PUT', body: { state: s } });
      if (j.ok) { toast('변경되었습니다.'); render(); } else toast(j.error || '오류');
    }));
    $$('[data-cap]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.cap, v = Number($('#cap' + id).value);
      const j = await api('/admin/programs/' + id, { method: 'PUT', body: { capacity: v } });
      if (j.ok) { toast('정원이 ' + v + '명으로 저장되었습니다.' + (j.promoted ? ' 대기 ' + j.promoted + '명이 자동 확정되었습니다.' : '')); render(); } else toast(j.error || '오류');
    }));
    $$('[data-st]').forEach((b) => (b.onclick = async () => {
      const s = b.dataset.st, id = b.dataset.id;
      const msg = { cancelled: '이 프로그램을 폐강하시겠습니까?\n(신규 신청만 차단됩니다.)', closed: '이 프로그램을 마감하시겠습니까?\n(신규 신청과 학생 셀프 취소가 모두 차단됩니다.)', open: '접수를 재개하시겠습니까?' }[s];
      if (!confirm(msg)) return;
      const j = await api('/admin/programs/' + id, { method: 'PUT', body: { status: s } });
      if (j.ok) { toast('변경되었습니다.'); render(); } else toast(j.error || '오류');
    }));
    $$('[data-view]').forEach((b) => (b.onclick = () => { filter = { program_id: b.dataset.view, status: 'all', q: '' }; tab = 'list'; frame(); render(); }));
    $$('[data-add]').forEach((b) => (b.onclick = () => addModal(b.dataset.add)));
  }

  // ---------- 신청자 목록 ----------
  function list(body) {
    body.innerHTML =
      '<div class="toolbar"><select id="fp"><option value="">전체 프로그램</option>' + programs.map((p) => '<option value="' + p.id + '"' + (String(p.id) === String(filter.program_id) ? ' selected' : '') + '>' + pLabel(p) + '</option>').join('') + '</select>' +
      '<select id="fs">' + [['all', '전체 상태'], ['confirmed', '확정'], ['waiting', '대기'], ['cancelled', '취소']].map((o) => '<option value="' + o[0] + '"' + (o[0] === filter.status ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<input type="search" id="fq" placeholder="이름 · 중학교 · 전화번호 검색" value="' + esc(filter.q) + '"><button class="btn btn-sm btn-plum" id="fadd">+ 수기 추가</button></div>' +
      '<div class="mini" style="margin-bottom:6px">총 <b>' + regs.length + '</b>건</div>' +
      '<div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>상태</th><th>프로그램</th><th>이름</th><th>휴대폰</th><th>중학교</th><th>반/번</th><th>내신%</th><th>보호자</th><th>담임교사</th><th>알레르기</th><th>신청시각(KST)</th><th>관리</th></tr></thead><tbody>' +
      (regs.map((r) => {
        const st = ST[r.status];
        return '<tr class="' + (r.status === 'cancelled' ? 'cx' : r.status === 'waiting' ? 'wt' : '') + '"><td>' + r.id + '</td><td><span class="chip ' + st[1] + '">' + st[0] + '</span>' + (r.is_manual ? ' <span class="chip c-man">수기</span>' : '') + (r.cancelled_by ? ' <span class="mini">(' + (r.cancelled_by === 'self' ? '본인' : '관리자') + ')</span>' : '') + '</td>' +
          '<td>' + SESSIONS[r.session].l + ' ' + DEPTS[r.dept].s + '</td><td><b>' + esc(r.name) + '</b></td><td>' + fmtPhone(r.phone) + '</td><td>' + esc(r.school) + '</td><td>' + (r.class_no || '-') + '/' + (r.student_no || '-') + '</td><td>' + (r.grade_pct == null ? '-' : r.grade_pct + '%') + '</td>' +
          '<td>' + esc(r.guardian_name) + '<br><span class="mini">' + fmtPhone(r.guardian_phone) + '</span></td><td>' + esc(r.teacher_name) + '<br><span class="mini">' + fmtPhone(r.teacher_phone) + '</span></td>' +
          '<td>' + (r.allergy ? '<span class="chip c-al">' + esc(r.allergy) + '</span>' : '-') + '</td><td>' + kst(r.created_at) + '</td>' +
          '<td><div class="row-act">' + (r.status === 'waiting' ? '<button class="btn btn-sm btn-plum" data-confirm="' + r.id + '">확정</button>' : '') + (r.status !== 'cancelled' ? '<button class="btn btn-sm btn-danger" data-cx="' + r.id + '" data-nm="' + esc(r.name) + '">취소</button>' : '') + '</div></td></tr>';
      }).join('') || '<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--muted)">신청 내역이 없습니다.</td></tr>') + '</tbody></table></div>';
    const reload = async () => { await loadRegs(); list(body); };
    $('#fp').onchange = (e) => { filter.program_id = e.target.value; reload(); };
    $('#fs').onchange = (e) => { filter.status = e.target.value; reload(); };
    let tm; $('#fq').oninput = (e) => { clearTimeout(tm); tm = setTimeout(async () => { filter.q = e.target.value; await loadRegs(); const pos = $('#fq'); list(body); const n = $('#fq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
    $('#fadd').onclick = () => addModal(filter.program_id);
    $$('[data-cx]').forEach((b) => (b.onclick = async () => {
      if (!confirm(b.dataset.nm + ' 학생의 신청을 취소하시겠습니까?\n(확정자 취소 시 대기 1번이 자동 확정됩니다.)')) return;
      const j = await api('/admin/registrations/' + b.dataset.cx + '/cancel', { method: 'POST', body: {} });
      if (j.ok) { toast('취소되었습니다.' + (j.promoted ? ' 대기자 ' + j.promoted + '명 자동 확정.' : '')); await loadOverview(); reload(); } else toast(j.error || '오류');
    }));
    $$('[data-confirm]').forEach((b) => (b.onclick = async () => {
      if (!confirm('대기자를 정원과 무관하게 확정하시겠습니까?')) return;
      const j = await api('/admin/registrations/' + b.dataset.confirm + '/confirm', { method: 'POST', body: {} });
      if (j.ok) { toast('확정되었습니다.'); reload(); } else toast('오류');
    }));
  }

  function addModal(pid) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = '<div class="box"><h3>관리자 수기 추가 <span class="mini">(정원 무관 · 즉시 확정)</span></h3><form id="af">' +
      '<label class="f">프로그램 *</label><select id="a_p">' + programs.map((p) => '<option value="' + p.id + '"' + (String(p.id) === String(pid) ? ' selected' : '') + '>' + pLabel(p) + '</option>').join('') + '</select>' +
      '<div class="row2"><div><label class="f">이름 *</label><input type="text" id="a_name"></div><div><label class="f">휴대폰 *</label><input type="tel" id="a_phone" inputmode="numeric" placeholder="010-0000-0000"></div></div>' +
      '<label class="f">소속 중학교 *</label><input type="text" id="a_school">' +
      '<div class="row2"><div><label class="f">반</label><input type="number" id="a_class"></div><div><label class="f">번호</label><input type="number" id="a_no"></div></div>' +
      '<div class="row2"><div><label class="f">예상 내신(%)</label><input type="number" step="0.1" id="a_pct"></div><div><label class="f">이메일</label><input type="email" id="a_email"></div></div>' +
      '<div class="row2"><div><label class="f">보호자 성함</label><input type="text" id="a_gn"></div><div><label class="f">보호자 연락처</label><input type="tel" id="a_gp" inputmode="numeric"></div></div>' +
      '<div class="row2"><div><label class="f">담임교사 성함</label><input type="text" id="a_tn"></div><div><label class="f">담임교사 연락처</label><input type="tel" id="a_tp" inputmode="numeric"></div></div>' +
      '<label class="f">알레르기 <small>(없으면 비워 두세요)</small></label><input type="text" id="a_al">' +
      '<div id="a_err" class="alert al-bad hide"></div><div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn btn-line" id="a_x" style="flex:1">닫기</button><button class="btn btn-primary" style="flex:2">추가</button></div></form></div>';
    document.body.appendChild(m);
    ['a_phone', 'a_gp', 'a_tp'].forEach((i) => bindPhone($('#' + i)));
    $('#a_x').onclick = () => m.remove();
    $('#af').onsubmit = async (e) => {
      e.preventDefault();
      const al = $('#a_al').value.trim();
      const j = await api('/admin/registrations', { body: { program_id: Number($('#a_p').value), name: $('#a_name').value, phone: $('#a_phone').value, school: $('#a_school').value, class_no: $('#a_class').value, student_no: $('#a_no').value, grade_pct: $('#a_pct').value, email: $('#a_email').value, guardian_name: $('#a_gn').value, guardian_phone: $('#a_gp').value, teacher_name: $('#a_tn').value, teacher_phone: $('#a_tp').value, allergy_has: !!al, allergy: al, uniform_ok: true, consent: true } });
      if (j.ok) { m.remove(); toast('추가되었습니다.'); render(); } else { const er = $('#a_err'); er.textContent = j.error || '오류'; er.classList.remove('hide'); }
    };
  }

  // ---------- 현장 출석 ----------
  async function filter2() {
    const body = $('#body');
    const qs = new URLSearchParams({ status: 'confirmed' });
    if (ciFilter.program_id) qs.set('program_id', ciFilter.program_id);
    if (ciFilter.q) qs.set('q', ciFilter.q);
    const j = await api('/admin/registrations?' + qs);
    if (await guard(j)) return;
    const items = j.items || [];
    const done = items.filter((r) => r.attended).length;
    body.innerHTML = '<div class="toolbar"><select id="cp"><option value="">전체 프로그램</option>' + programs.map((p) => '<option value="' + p.id + '"' + (String(p.id) === String(ciFilter.program_id) ? ' selected' : '') + '>' + pLabel(p) + '</option>').join('') + '</select>' +
      '<input type="search" id="cq" placeholder="🔍 이름 · 중학교 · 전화번호(뒷자리) 검색" value="' + esc(ciFilter.q) + '" autocomplete="off"></div>' +
      '<div class="mini" style="margin-bottom:8px">확정자 <b>' + items.length + '</b>명 중 출석 <b style="color:var(--ok)">' + done + '</b>명 · 체크박스를 눌러 출석 처리하세요.</div><div class="ci-list">' +
      (items.map((r) => '<label class="ci ' + (r.attended ? 'on' : '') + '"><input type="checkbox" data-a="' + r.id + '"' + (r.attended ? ' checked' : '') + '><div style="flex:1"><div class="nm">' + esc(r.name) + ' <span class="mini">' + esc(r.school) + '</span></div><div class="mt">' + SESSIONS[r.session].l + ' ' + DEPTS[r.dept].s + ' · ' + fmtPhone(r.phone) + (r.class_no ? ' · 3-' + r.class_no + '-' + r.student_no : '') + (r.attended_at ? ' · 출석 ' + kst(r.attended_at).slice(11) : '') + '</div>' + (r.allergy ? '<div class="al">⚠ 알레르기: ' + esc(r.allergy) + '</div>' : '') + '</div></label>').join('') || '<div class="card mini">검색 결과가 없습니다.</div>') + '</div>';
    $('#cp').onchange = (e) => { ciFilter.program_id = e.target.value; filter2(); };
    let tm; const q = $('#cq'); q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { ciFilter.q = q.value; await filter2(); const n = $('#cq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    $$('[data-a]').forEach((c) => (c.onchange = async () => {
      const r = await api('/admin/registrations/' + c.dataset.a + '/attend', { body: { attended: c.checked } });
      if (!r.ok) { toast('저장 실패'); c.checked = !c.checked; return; }
      c.closest('.ci').classList.toggle('on', c.checked); toast(c.checked ? '출석 처리' : '출석 해제');
    }));
  }

  // ---------- 엑셀 ----------
  function exportView(body) {
    body.innerHTML = '<div class="dl"><div class="card"><h3 style="margin:0 0 6px;color:var(--plum)">📥 전체 엑셀 (.xlsx)</h3><p class="mini">시트: 전체신청현황 · 차시·학과별 요약 · 소속 중학교별 명단(공문용) · 차시·학과별 출석부(6개) · 알레르기 체크 명단<br>취소 건은 제외하고 확정·대기자만 명단에 포함됩니다.</p><button class="btn btn-primary btn-block" id="dlx">엑셀 다운로드</button></div>' +
      '<div class="card"><h3 style="margin:0 0 6px;color:var(--plum)">🏫 공문용 명단만</h3><p class="mini">확정자만 소속 중학교별로 묶은 명단 (대기·취소 제외)</p><button class="btn btn-plum btn-block" id="dls">중학교별 명단 다운로드</button></div></div>';
    $('#dlx').onclick = () => makeXlsx(false);
    $('#dls').onclick = () => makeXlsx(true);
  }
  async function makeXlsx(schoolOnly) {
    if (!window.XLSX) return toast('엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    const all = await allRegs(); if (!all) return;
    const pm = {}; programs.forEach((p) => (pm[p.id] = p));
    const pn = (r) => SESSIONS[r.session].l + ' ' + DEPTS[r.dept].n;
    const stK = { confirmed: '확정', waiting: '대기', cancelled: '취소' };
    const active = all.filter((r) => r.status !== 'cancelled');
    const conf = all.filter((r) => r.status === 'confirmed');
    const wb = XLSX.utils.book_new();
    const add = (name, rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (cols) ws['!cols'] = cols.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
    const ph = (s) => (window.fmtPhone ? fmtPhone(s) : s);

    // 소속 중학교별 명단
    const bySchool = {}; conf.forEach((r) => (bySchool[r.school] = bySchool[r.school] || []).push(r));
    const sRows = [['소속 중학교', '인원', '학년', '반', '번호', '이름', '신청 차시', '희망 학과', '담임(진로)교사', '교사 연락처']];
    Object.keys(bySchool).sort((a, b) => a.localeCompare(b, 'ko')).forEach((s) => {
      bySchool[s].sort((a, b) => a.name.localeCompare(b.name, 'ko')).forEach((r) => sRows.push([s, bySchool[s].length, 3, r.class_no || '', r.student_no || '', r.name, SESSIONS[r.session].l + ' (' + SESSIONS[r.session].prog + ')', DEPTS[r.dept].n, r.teacher_name, ph(r.teacher_phone)]));
    });
    const sCols = [18, 6, 6, 6, 6, 10, 22, 16, 14, 15];
    if (schoolOnly) { add('소속 중학교별 명단', sRows, sCols); XLSX.writeFile(wb, '진로캠프_중학교별명단_' + today() + '.xlsx'); return; }

    add('전체신청현황', [['번호', '상태', '신청 차시', '학과', '이름', '휴대폰', '이메일', '소속 중학교', '학년', '반', '번호', '예상 내신(%)', '보호자', '보호자 연락처', '담임(진로)교사', '교사 연락처', '알레르기', '교복확인', '수기추가', '출석', '신청시각(KST)', '취소시각(KST)', '취소자']]
      .concat(all.map((r) => [r.id, stK[r.status], SESSIONS[r.session].l + ' (' + SESSIONS[r.session].prog + ')', DEPTS[r.dept].n, r.name, ph(r.phone), r.email || '', r.school, 3, r.class_no || '', r.student_no || '', r.grade_pct == null ? '' : r.grade_pct + '%', r.guardian_name, ph(r.guardian_phone), r.teacher_name, ph(r.teacher_phone), r.allergy || '없음', r.uniform_ok ? 'Y' : '', r.is_manual ? 'Y' : '', r.attended ? 'Y' : '', kst(r.created_at), kst(r.cancelled_at), r.cancelled_by ? (r.cancelled_by === 'self' ? '본인' : '관리자') : ''])),
      [6, 6, 22, 16, 10, 15, 22, 16, 5, 5, 5, 10, 10, 15, 12, 15, 18, 8, 8, 6, 17, 17, 8]);

    add('차시·학과별 요약', [['차시', '시간', '학과', '정원', '확정', '대기', '취소', '잔여', '출석', '상태', '등록 장소', '상담 장소']]
      .concat(programs.map((p) => [SESSIONS[p.session].l, SESSIONS[p.session].prog, DEPTS[p.dept].n, p.capacity, p.confirmed, p.waiting, p.cancelled, Math.max(0, p.capacity - p.confirmed), p.attended, PST[p.status][0], '학교 정문', DEPTS[p.dept].c]))
      .concat([['합계', '', '', programs.reduce((a, p) => a + p.capacity, 0), programs.reduce((a, p) => a + p.confirmed, 0), programs.reduce((a, p) => a + p.waiting, 0), programs.reduce((a, p) => a + p.cancelled, 0), '', programs.reduce((a, p) => a + p.attended, 0), '', '', '']]),
      [6, 14, 16, 6, 6, 6, 6, 6, 6, 8, 10, 14]);

    add('소속 중학교별 명단', sRows, sCols);

    programs.forEach((p) => {
      const rows = conf.filter((r) => r.program_id === p.id).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      const t = [[SESSIONS[p.session].l + ' ' + DEPTS[p.dept].n + ' 출석부 (' + SESSIONS[p.session].prog + ' / 등록 ' + SESSIONS[p.session].reg + ' 학교 정문)'], ['No', '이름', '소속 중학교', '반/번', '휴대폰', '알레르기', '출석(✔)', '비고']]
        .concat(rows.map((r, i) => [i + 1, r.name, r.school, (r.class_no || '-') + '/' + (r.student_no || '-'), ph(r.phone), r.allergy || '', r.attended ? '✔' : '', r.is_manual ? '수기추가' : '']));
      add('출석부_' + SESSIONS[p.session].l + '_' + DEPTS[p.dept].s, t, [5, 10, 18, 8, 15, 20, 9, 10]);
    });

    const al = active.filter((r) => r.allergy).sort((a, b) => a.session - b.session || a.dept.localeCompare(b.dept));
    add('알레르기 체크 명단', [['신청 차시', '학과', '이름', '소속 중학교', '상태', '알레르기 항목', '보호자 연락처']]
      .concat(al.length ? al.map((r) => [SESSIONS[r.session].l, DEPTS[r.dept].n, r.name, r.school, stK[r.status], r.allergy, ph(r.guardian_phone)]) : [['알레르기 신청자 없음']]), [8, 16, 10, 18, 6, 28, 15]);

    XLSX.writeFile(wb, '진로캠프_신청명단_' + today() + '.xlsx');
    toast('다운로드를 시작합니다.');
  }
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

  // ---------- QR ----------
  function qrView(body) {
    const url = location.origin + '/';
    let svg = '';
    try { const q = qrcode(0, 'M'); q.addData(url); q.make(); svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { svg = '<p class="mini">QR 라이브러리를 불러오지 못했습니다.</p>'; }
    body.innerHTML = '<div class="card qrbox" style="max-width:420px;margin:0 auto"><h3 style="color:var(--plum);margin:0 0 6px">신청 페이지 QR 코드</h3><div id="qrsvg" style="background:#fff;display:inline-block;padding:6px">' + svg + '</div>' +
      '<p style="word-break:break-all"><b id="qurl">' + esc(url) + '</b></p><div style="display:grid;gap:8px"><button class="btn btn-plum" id="qcopy">링크 복사</button><button class="btn btn-line" id="qpng">QR 이미지(PNG) 저장</button></div>' +
      '<p class="mini">⚠️ 이 QR은 현재 접속한 주소 기준입니다. 정식 배포 후 <b>배포된 주소의 관리자 페이지</b>에서 다시 만들어 계획서 표지에 넣어 주세요.</p></div>';
    $('#qcopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('복사되었습니다.'); } catch (e) { prompt('링크를 복사하세요', url); } };
    $('#qpng').onclick = () => {
      const s = $('#qrsvg svg'); if (!s) return;
      const xml = new XMLSerializer().serializeToString(s); const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 800); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 800, 800); const a = document.createElement('a'); a.download = 'MICE진로캠프_신청QR.png'; a.href = c.toDataURL('image/png'); a.click(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    };
  }

  async function boot() {
    const j = await api('/admin-session');
    if (j.ok) { frame(); render(); } else loginView();
  }
  boot();
})();
