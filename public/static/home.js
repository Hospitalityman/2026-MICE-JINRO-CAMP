(async function () {
  const j = await api('/programs');
  if (!j.programs) { $('#status-box').textContent = '현황을 불러오지 못했습니다.'; return; }
  $('#gate-msg').innerHTML = gateAlert(j.gate);
  if (!j.gate.open) { const b = $('#apply-btn'); b.setAttribute('aria-disabled', 'true'); b.style.opacity = .55; b.textContent = '📝 신청 안내'; }
  let h = '';
  [1, 2, 3].forEach((s) => {
    h += '<div style="padding:8px 0;border-bottom:1px dashed var(--line)"><b style="color:var(--plum)">' + SESSIONS[s].l + '</b> <span class="mini">' + SESSIONS[s].prog + '</span>';
    j.programs.filter((p) => p.session === s).forEach((p) => {
      const st = slotState(p);
      const pct = Math.min(100, Math.round((p.confirmed / Math.max(1, p.capacity)) * 100));
      h += '<div style="margin-top:6px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:.88rem"><span>' + DEPTS[p.dept].n + '</span><span><span class="badge ' + st.cls + '">' + st.t + '</span> <b>' + p.confirmed + '/' + p.capacity + '</b></span></div><div class="bar"><i class="' + (pct >= 100 ? 'full' : pct >= 80 ? 'hi' : '') + '" style="width:' + pct + '%"></i></div></div>';
    });
    h += '</div>';
  });
  $('#status-box').innerHTML = h;
})();
