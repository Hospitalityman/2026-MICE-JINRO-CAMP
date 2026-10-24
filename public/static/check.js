(function () {
  bindPhone($('#phone'));
  const form = $('#lookup-form'), out = $('#lk-result');
  let last = null;
  async function lookup() {
    const err = $('#lk-err'); err.classList.add('hide');
    const btn = $('#lk-btn'); btn.disabled = true;
    const j = await api('/lookup', { body: { name: $('#name').value, phone: $('#phone').value } });
    btn.disabled = false;
    if (!j.ok) { err.textContent = j.error || '조회 중 오류가 발생했습니다.'; err.classList.remove('hide'); out.innerHTML = ''; return; }
    last = { name: $('#name').value, phone: $('#phone').value };
    if (!j.items.length) { out.innerHTML = '<div class="alert al-warn">조회된 신청 내역이 없습니다. 이름·휴대폰 번호를 다시 확인해 주세요.<br>(이미 취소한 신청은 표시되지 않습니다.)</div>'; return; }
    out.innerHTML = j.items.map((it) => {
      const wait = it.status === 'waiting';
      const canCancel = j.cancelAllowed && it.programStatus !== 'closed';
      return '<div class="res"><h3>' + SESSIONS[it.session].l + ' · ' + DEPTS[it.dept].n + '</h3>' +
        '<div class="meta">' + SESSIONS[it.session].prog + ' (등록 ' + SESSIONS[it.session].reg + ' · 학교 정문)<br>상담 장소: ' + DEPTS[it.dept].c + ' · ' + esc(it.school) + '</div>' +
        '<div class="alert ' + (wait ? 'al-warn' : 'al-ok') + '" style="margin:0 0 10px">' + (wait ? '⏳ 대기 ' + it.waitingNo + '번 — 취소자가 생기면 자동 확정됩니다.' : '✅ 참가 확정' + (it.promoted ? ' (대기에서 확정되었어요!)' : '')) + '</div>' +
        (it.programStatus === 'closed' ? '<div class="mini">인원이 확정되어 취소할 수 없습니다. 문의 070-4803-6923</div>' :
         !j.cancelAllowed ? '<div class="mini">취소 가능 기간(' + esc(j.deadline) + '까지)이 지났습니다. 문의 070-4803-6923</div>' : '') +
        (canCancel ? '<button class="btn btn-danger btn-sm" data-id="' + it.id + '">신청 취소하기</button>' : '') + '</div>';
    }).join('');
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); lookup(); });
  out.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    if (!confirm('정말 신청을 취소하시겠습니까?\n취소 후에는 되돌릴 수 없으며, 다시 신청하면 정원이 찬 경우 대기가 될 수 있습니다.')) return;
    b.disabled = true;
    const j = await api('/cancel', { body: { id: Number(b.dataset.id), name: last.name, phone: last.phone } });
    if (!j.ok) { alert(j.error || '취소 중 오류가 발생했습니다.'); b.disabled = false; return; }
    alert('신청이 취소되었습니다.');
    lookup();
  });
})();
