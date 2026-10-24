(function () {
  const form = $('#apply-form');
  let programs = [];
  let gateOpen = true;
  bindPhone($('#phone')); bindPhone($('#guardian_phone')); bindPhone($('#teacher_phone'));

  $$('input[name=allergy_has]').forEach((r) => r.addEventListener('change', () => {
    const on = $('input[name=allergy_has]:checked').value === '1';
    $('#allergy-wrap').classList.toggle('hide', !on);
    if (on) $('#allergy').focus();
  }));

  function renderSlots(keep) {
    const sel = keep || (($('input[name=program]:checked') || {}).value);
    let h = '';
    [1, 2, 3].forEach((s) => {
      h += '<div class="sess"><header><b>' + SESSIONS[s].l + '</b><span>프로그램 ' + SESSIONS[s].prog + ' · 등록 ' + SESSIONS[s].reg + '</span></header><div class="opts">';
      programs.filter((p) => p.session === s).forEach((p) => {
        const st = slotState(p);
        const pct = Math.min(100, Math.round((p.confirmed / Math.max(1, p.capacity)) * 100));
        const cnt = st.k === 'off' ? '신청 불가' : st.k === 'full' ? ('정원 ' + p.capacity + '명 마감 · 대기 ' + p.waiting + '명') : ('잔여 ' + st.left + '석 (' + p.confirmed + '/' + p.capacity + ')');
        h += '<label class="opt"><input type="radio" name="program" value="' + p.id + '"' + (st.dis || !gateOpen ? ' disabled' : '') + (String(p.id) === String(sel) ? ' checked' : '') + '>' +
          '<span class="box"><b>' + DEPTS[p.dept].n + '</b><span class="badge ' + st.cls + '">' + st.t + '</span>' +
          '<span class="bar"><i class="' + (pct >= 100 ? 'full' : pct >= 80 ? 'hi' : '') + '" style="width:' + pct + '%"></i></span>' +
          '<span class="cnt">' + cnt + '</span></span></label>';
      });
      h += '</div></div>';
    });
    $('#slot-list').innerHTML = h;
    $$('input[name=program]').forEach((r) => r.addEventListener('change', showPick));
    showPick();
  }
  function showPick() {
    const v = ($('input[name=program]:checked') || {}).value;
    const box = $('#slot-pick');
    if (!v) { box.classList.add('hide'); return; }
    const p = programs.find((x) => String(x.id) === String(v));
    const st = slotState(p);
    box.classList.remove('hide');
    box.innerHTML = '✅ 선택: <b>' + SESSIONS[p.session].l + ' · ' + DEPTS[p.dept].n + '</b> (' + SESSIONS[p.session].prog + ')<br>상담 장소: ' + DEPTS[p.dept].c +
      (st.k === 'full' ? '<br>⚠️ 정원이 찼습니다. <b>대기자</b>로 접수되며, 취소자가 생기면 순번대로 자동 확정됩니다.' : '');
  }
  async function load(keep) {
    const j = await api('/programs');
    if (!j.programs) { $('#slot-list').innerHTML = '<div class="alert al-bad">현황을 불러오지 못했습니다. 새로고침 해 주세요.</div>'; return; }
    programs = j.programs; gateOpen = j.gate.open;
    $('#gate-msg').innerHTML = gateAlert(j.gate);
    $('#submit-btn').disabled = !gateOpen;
    renderSlots(keep);
  }

  function showErr(msg, field) {
    const e = $('#form-err'); e.textContent = msg; e.classList.remove('hide');
    $$('.err-f').forEach((x) => x.classList.remove('err-f'));
    let el = field && (document.getElementById(field) || (field === 'program_id' ? $('#slot-list') : null));
    if (el) { el.classList.add('err-f'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.focus && field !== 'program_id') el.focus({ preventScroll: true }); }
    else e.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#form-err').classList.add('hide');
    const pid = ($('input[name=program]:checked') || {}).value;
    if (!pid) return showErr('1. 차시·학과를 선택해 주세요.', 'program_id');
    const allergyHas = $('input[name=allergy_has]:checked').value === '1';
    const body = {
      program_id: Number(pid),
      name: $('#name').value, phone: $('#phone').value, email: $('#email').value, school: $('#school').value,
      class_no: $('#class_no').value, student_no: $('#student_no').value, grade_pct: $('#grade_pct').value,
      guardian_name: $('#guardian_name').value, guardian_phone: $('#guardian_phone').value,
      teacher_name: $('#teacher_name').value, teacher_phone: $('#teacher_phone').value,
      allergy_has: allergyHas, allergy: $('#allergy').value,
      uniform_ok: $('#uniform_ok').checked, consent: $('#consent').checked,
    };
    const btn = $('#submit-btn'); const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 접수 중…';
    let j;
    try { j = await api('/register', { body }); } catch (e) { j = { ok: false, error: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }; }
    btn.disabled = false; btn.innerHTML = old;
    if (!j.ok) {
      showErr(j.error || '신청 중 오류가 발생했습니다.', j.field);
      if (['PROGRAM_CLOSED', 'PROGRAM_CANCELLED', 'CLOSED'].includes(j.code)) load();
      return;
    }
    const d = $('#done-box');
    const wait = j.status === 'waiting';
    d.innerHTML = '<div class="big">' + (wait ? '⏳' : '🎉') + '</div><h2>' + (wait ? '대기 ' + j.waitingNo + '번으로 접수되었어요' : '신청이 완료되었어요!') + '</h2>' +
      '<p class="mini">' + esc(j.name) + ' 학생, 신청해 주셔서 감사합니다.</p>' +
      '<div class="ticket"><div><b>신청 차시</b><span>' + SESSIONS[j.session].l + ' (' + SESSIONS[j.session].prog + ')</span></div>' +
      '<div><b>학과</b><span>' + DEPTS[j.dept].n + '</span></div>' +
      '<div><b>상태</b><span>' + (wait ? '대기 ' + j.waitingNo + '번' : '참가 확정') + '</span></div>' +
      '<div><b>등록</b><span>' + SESSIONS[j.session].reg + ' · 학교 정문</span></div>' +
      '<div><b>준비물</b><span>교복(또는 체육복)</span></div></div>' +
      (wait ? '<div class="alert al-warn">정원이 차서 대기로 접수되었습니다. 취소자가 생기면 대기 순번대로 <b>자동 확정</b>됩니다.<br>확정 여부는 「신청 조회」에서 확인해 주세요.</div>' : '') +
      '<p class="mini">변경이 필요하면 「조회·취소」에서 취소한 뒤 다시 신청해 주세요. (취소는 11월 11일까지)<br>문의 070-4803-6923</p>' +
      '<p style="display:grid;gap:8px"><a class="btn btn-plum" href="/check">신청 조회 · 취소</a><a class="btn btn-line" href="/">홈으로</a></p>';
    form.classList.add('hide'); d.classList.remove('hide'); window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  load();
  setInterval(() => { if (!document.hidden && !form.classList.contains('hide')) load(); }, 20000);
})();
