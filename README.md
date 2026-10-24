# 2026학년도 학과 중점 MICE 진로캠프 신청 시스템

부산관광고등학교 특성화운영부 · **먹 GO! 보 GO! 듣 GO! 관광 GO!**
중3 대상 차시·학과별 신청 접수, 학과별 30명 선착순 자동 정원 관리, 행사 후 공문 발송용 명단 생성.

## 주요 기능 (완료)
- 모바일 우선 반응형 신청 페이지 (가을 테마, GO 3카드, 진행 순서, 차시별 시간·장소, 실시간 정원 현황)
- 6개 프로그램(3차시 × 2학과) 선택 · 정원 표시(잔여석/마감임박/대기접수)
- 신청서: 이름, 휴대폰(자동 하이픈), 이메일, 중학교, 3학년 고정+반/번호, 예상 내신(% 숫자), 보호자, 담임(진로)교사, 알레르기, 교복 확인, 개인정보 동의
- **정원 초과 시 자동 대기 등록 / 취소 시 대기 1번 자동 확정** (정원 판단+INSERT를 단일 SQL로 처리 → 동시 신청에도 초과 없음, 35명 동시 테스트 통과)
- **1인 1회**: 이름+휴대폰 기준 중복 차단(DB 유니크 인덱스로 보장)
- 신청 조회 · 셀프 취소 (이름+휴대폰, 11/11까지, 마감된 프로그램은 취소 불가)
- 관리자: 6개 프로그램 현황, 정원 수정(증가 시 대기 자동 승격), 폐강(신규만 차단), 마감(신규+취소 차단), 수기 추가(정원 무관), 건별 취소, 대기자 수동 확정, 신청 접수 전체 마감/열기/자동
- 관리자 현장 출석 체크 + 이름/중학교/전화번호 검색
- 엑셀(.xlsx): 전체신청현황 · 차시·학과별 요약 · 소속 중학교별 명단 · 차시·학과별 출석부(6개) · 알레르기 체크 명단
- 신청 QR 코드 생성(PNG 저장)

## 경로
| 경로 | 설명 |
|---|---|
| `/` | 메인(행사 안내, 현황) |
| `/apply` | 신청서 |
| `/check` | 신청 조회·취소 |
| `/admin` | 관리자 (비밀번호 로그인; 환경변수 ADMIN_PASSWORD 필수) |
| `/api/programs` | 정원 현황(공개) |
| `/api/register` `/api/lookup` `/api/cancel` | 신청/조회/취소 |
| `/api/admin/*` | 관리자 API (쿠키 인증) |

## 데이터 (Cloudflare D1)
`programs`(정원·상태), `registrations`(신청, status: confirmed/waiting/cancelled), `settings`(접수 상태), `login_fail`(로그인 시도 제한). 스키마: `migrations/0001_init.sql`

## 설정
- 행사 정보/장소/시간: `src/config.ts`
- 관리자 비밀번호: 환경변수 `ADMIN_PASSWORD` (로컬 `.dev.vars`, 배포 시 secret). 미설정 시 관리자 로그인 불가
- 신청 접수: 관리자 > 현황에서 `자동(11/11 23:59까지)` / `강제 열기` / `신청 마감` 전환

## 로컬 실행
```
npm run build
npm run db:migrate:local
pm2 start ecosystem.config.cjs
```

## 배포 (Cloudflare Pages · 사용자 계정)
- **운영 주소**: https://busan-mice-camp.pages.dev  (관리자: /admin)
- Pages 프로젝트: `busan-mice-camp` / D1: `mice-camp-production` (바인딩 `DB`)
- 관리자 비밀번호는 Pages secret `ADMIN_PASSWORD`로 저장 (코드·저장소에 없음)
- 재배포: `npm run build && npx wrangler pages deploy dist --project-name busan-mice-camp --branch main`
- 스키마 변경 시: `npm run db:migrate:prod`

## 필수 입력 항목
이름, 휴대폰, 이메일, 중학교, 반·번호, 예상 내신(%), 보호자 성함·연락처, 담임교사 성함·연락처, 알레르기(없음/있음), 교복 확인, 개인정보 동의 — 모두 필수. (관리자 수기 추가는 이름·휴대폰·중학교만 필수)
