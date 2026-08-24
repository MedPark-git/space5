# MedPark 채권관리 콘솔 — space_05 배포 (DB 연동판)

DB(PostgreSQL/MySQL)에 실제로 데이터를 저장하는 Flask + React 구성입니다.

## 자동 시딩

앱이 처음 기동될 때(`backend/app.py`) 테이블이 없으면 자동으로 만들고, users 테이블이 비어있으면 자동으로 초기 데이터(거래처 372건, 수금기록 29건, 계정 6개)를 채웁니다. 별도 명령 없이 배포만 하면 로그인 화면이 바로 뜹니다.

## DB 환경변수

AI Space가 DB를 프로비저닝하면 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD를 자동 주입해줍니다 — 별도 설정 불필요.
직접 지정하려면 DATABASE_URL을 쓰면 그게 우선됩니다.

## 로그인 / 초기 비밀번호

| 아이디 | 초기 비밀번호 | 이름 |
|---|---|---|
| Medpark0 | 시스템관리자 | 시스템관리자 |
| Medpark1 | 대표이사 | 대표이사 |
| Medpark2 | 김태현 상무 | 김태현 상무 |
| Medpark3 | 김홍윤 수석 | 김홍윤 수석 |
| Medpark4 | 박재흥 | 박재흥 |
| Medpark5 | 김정훈 | 김정훈 |

로그인 후 우측 상단 메뉴의 "비밀번호 변경"에서 각자 바꿀 수 있습니다.

## 달라진 점

- 로그인 전에는 서버에서도 모든 데이터 API가 401을 반환합니다.
- 비밀번호는 해시로만 저장되고 클라이언트로는 내려가지 않습니다.
- 화면에서 뭔가 바뀌면 자동으로 PUT /api/customers 등을 호출해 DB에 반영됩니다.

## 아직 남은 작업

- `src/App.jsx`(원본 소스)와 `dist/assets/main.js`(빌드된 프론트엔드 번들)는 파일 크기 문제로 이 커밋에는 아직 포함되지 않았습니다 — 로컬에서 `npm install && npm run build` 후 `dist/assets/main.js`를 커밋하거나, 직접 git push로 추가해야 화면이 정상적으로 뜹니다.
