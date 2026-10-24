window.SESSIONS = {1:{l:'1차',reg:'12:30~13:00',prog:'13:00~14:45'},2:{l:'2차',reg:'14:30~15:00',prog:'15:00~16:45'},3:{l:'3차',reg:'16:30~17:00',prog:'17:00~18:45'}};
window.DEPTS = {tour:{n:'MICE 관광과',s:'관광과',c:'8층 바텐더실'},cook:{n:'MICE 외식조리과',s:'외식조리과',c:'일식실'}};
window.$ = (s, r) => (r || document).querySelector(s);
window.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
window.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.fmtPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.startsWith('02')) { // 서울 지역번호
    if (d.length < 3) return d;
    if (d.length < 7) return d.replace(/(\d{2})(\d+)/, '$1-$2');
    if (d.length < 10) return d.replace(/(\d{2})(\d{3})(\d+)/, '$1-$2-$3');
    return d.replace(/(\d{2})(\d{4})(\d+)/, '$1-$2-$3');
  }
  if (d.length < 4) return d;
  if (d.length < 8) return d.replace(/(\d{3})(\d+)/, '$1-$2');
  if (d.length < 11) return d.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3');
  return d.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
};
window.bindPhone = (el) => el && el.addEventListener('input', () => { el.value = fmtPhone(el.value); });
window.api = async (path, opt) => {
  opt = opt || {};
  const r = await fetch('/api' + path, {
    method: opt.method || (opt.body ? 'POST' : 'GET'),
    headers: opt.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opt.body ? JSON.stringify(opt.body) : undefined,
    credentials: 'same-origin',
  });
  let j = {}; try { j = await r.json(); } catch (e) {}
  j._status = r.status; return j;
};
window.slotState = (p) => {
  if (p.status === 'cancelled') return { k: 'off', t: '폐강', cls: 'b-off', dis: true };
  if (p.status === 'closed') return { k: 'off', t: '마감', cls: 'b-off', dis: true };
  const left = p.capacity - p.confirmed;
  if (left > 0 && p.waiting === 0) return left <= 5 ? { k: 'few', t: '마감임박', cls: 'b-few', dis: false, left } : { k: 'ok', t: '신청가능', cls: 'b-ok', dis: false, left };
  return { k: 'full', t: '정원마감 · 대기접수', cls: 'b-full', dis: false, left: 0 };
};
window.gateAlert = (g) => g && !g.open ? '<div class="alert al-warn">⏸ ' + esc(g.reason) + '</div>' : '';
