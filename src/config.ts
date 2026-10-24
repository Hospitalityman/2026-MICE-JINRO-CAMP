// 행사 기본 정보 (한 곳에서 관리)
export const EVENT = {
  org: '부산관광고등학교 특성화운영부',
  title: '2026학년도 학과 중점 MICE 진로캠프',
  slogan: '먹 GO! 보 GO! 듣 GO! 관광 GO!',
  tagline: '2027 부산관광고, 입시 전에 먼저 맛보GO!',
  date: '2026년 11월 13일(금)',
  dateShort: '11/13(금)',
  place: '부산관광고등학교',
  target: '중학교 3학년',
  fee: '무료',
  uniform: '소속 중학교 교복 (체육복이 교내 규정인 경우 체육복 가능)',
  contact: '070-4803-6923',
  teacher: '특성화운영부 민희찬 선생님',
  regPlace: '학교 정문',
  gatherPlace: '세미나실',
  applyPeriodText: '2026년 10월 26일(월) ~ 11월 11일(수)',
  cancelDeadline: '2026-11-12T00:00:00+09:00', // 11/11 23:59:59 KST 까지 셀프 취소 가능
  cancelDeadlineText: '11월 11일(수)',
  defaultCapacity: 30,
}

export const SESSIONS: Record<number, { label: string; reg: string; prog: string }> = {
  1: { label: '1차', reg: '12:30~13:00', prog: '13:00~14:45' },
  2: { label: '2차', reg: '14:30~15:00', prog: '15:00~16:45' },
  3: { label: '3차', reg: '16:30~17:00', prog: '17:00~18:45' },
}

export const DEPTS: Record<string, { name: string; short: string; counsel: string }> = {
  tour: { name: 'MICE 관광과', short: '관광과', counsel: '8층 바텐더실' },
  cook: { name: 'MICE 외식조리과', short: '외식조리과', counsel: '일식실' },
}

export function programLabel(session: number, dept: string) {
  return `${SESSIONS[session]?.label ?? session} · ${DEPTS[dept]?.name ?? dept}`
}
