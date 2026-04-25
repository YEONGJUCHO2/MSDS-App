# MSDS 관리자동화·변경감시 MVP 설계

## 목적

로컬 환경에서 MSDS PDF를 읽고, 사내 MSDS 등록 화면에 필요한 후보값을 만들며, 담당자가 원문과 공식 출처를 보면서 검수한 뒤 사내 시스템에 직접 옮겨 입력할 수 있게 돕는다.

동시에 검수된 MSDS 데이터를 제품·성분·현장·공급사 단위로 누적하여, 이후 관리대장 자동화와 CAS No. 기반 변경감시로 이어질 수 있는 기반을 만든다.

이 MVP는 법적 최종판정 시스템이 아니며, 사내 시스템에 자동 등록하지 않는다.

## 제품 포지션

이 제품은 범용 법령 검색 챗봇이 아니라 **사내 MSDS 등록·관리·변경감시 업무를 줄이기 위한 로컬 AI 검수 도구**다.

1차 MVP의 첫 사용 장면은 사내 시스템 직접 입력 보조이지만, 제품의 중심 가치는 다음 세 축으로 둔다.

1. **등록 보조**: MSDS에서 사내 등록 필드 후보값을 만들고 근거와 함께 검수한다.
2. **관리자동화**: 검수된 값을 제품, 성분, 현장, 공급사 기준으로 저장해 관리대장과 요청 리스트를 만든다.
3. **변경감시**: 사업장에서 사용하는 CAS No. watchlist를 만들고, 이후 공식 출처 재조회와 변경 후보 알림으로 확장한다.

핵심 흐름은 다음과 같다.

```text
MSDS PDF 업로드
→ 로컬에서 텍스트/표 추출
→ Codex CLI로 등록 후보값 구조화
→ 원문/공식 출처와 함께 후보값 표시
→ 담당자가 확인, 수정, 보류 처리
→ 담당자가 사내 MSDS 시스템에 직접 복사 입력
```

## MVP 목표

1. MSDS를 읽고 사내 시스템에 입력하는 시간을 줄인다.
2. 물품 기본정보, 성분/함유량, 유해성 위험성, 법적 규제 항목 등 필수 등록 필드의 후보값을 만든다.
3. 각 후보값마다 원문 또는 공식 출처 근거를 보여준다.
4. 이전 법령 조회 앱의 실패를 반복하지 않기 위해, 자연어 기반 전체 법령 검색이 아니라 CAS No. 기반 제한 조회로 설계한다.
5. MVP에서는 Codex CLI를 쓰되, 추후 OpenAI API, 로컬 LLM, 사내망 모델 등으로 교체할 수 있게 AI 호출부를 분리한다.
6. 검수 완료된 MSDS를 제품·성분·현장·공급사 데이터로 누적해 관리대장 자동화의 기반을 만든다.
7. MSDS에서 추출된 CAS No.를 watchlist로 저장해 향후 변경감시 기능의 입력 데이터로 사용한다.
8. 산안법/화관법 관련 내부 기준표를 시드 데이터로 두어, fixture가 아니라 실제 CAS 기반 후보값을 반환한다.
9. 제품별 MSDS 개정본을 비교해 CAS 추가/삭제, 함유량 변경, 유해성·위험성 변경 후보를 보여준다.
10. 검수 완료와 사내 시스템 등록 완료를 분리해 관리한다.

## 제외 범위

1. 자연어 질문으로 대한민국 전체 법령을 검색하지 않는다.
2. AI가 법적 항목을 최종 확정하지 않는다.
3. 사내 시스템에 자동 등록하지 않는다.
4. 1차 MVP에서 모든 스캔본 PDF의 완벽한 OCR을 목표로 하지는 않지만, 스캔본 감지와 제한적 로컬 OCR 시도, 실패 시 수동입력/공급사 요청 흐름은 포함한다.
5. 필수 등록 필드를 조용히 빈칸으로 남기지 않는다.
6. 1차 MVP에서 공식 DB 전체를 주기적으로 수집하거나 전체 법령을 변경감시하지 않는다.
7. 1차 MVP에서 모든 MSDS 4~15번 항목을 사내 등록 필드로 확장하지 않는다. 단, 사내 시스템 필수 항목으로 확인되면 별도 스키마에 추가한다.

## 대상 업무 흐름

### 1. PDF 업로드

사용자가 MSDS PDF를 업로드한다. 앱은 PDF를 로컬에 저장하고 파일명, 해시값, 업로드일, 처리상태를 기록한다.

### 2. 로컬 텍스트/표 추출

AI 호출 전에 앱이 먼저 PDF에서 텍스트와 표를 로컬로 추출한다. 이렇게 해야 AI 프롬프트가 작아지고, AI가 원본 PDF 파싱까지 모두 책임지는 구조를 피할 수 있다.

PDF 처리는 텍스트 추출과 표 추출을 분리한다. `pdf-parse` 같은 plain text 추출만으로 MSDS 3번 구성성분 표를 처리하면 CAS No., 화학물질명, 함유량이 서로 섞일 수 있으므로, MVP에는 좌표 기반 표 추출 단계를 포함한다.

```text
PDF 업로드
→ 텍스트 레이어 존재 여부 확인
→ 텍스트 PDF: 본문 텍스트 추출 + 좌표 기반 표 후보 추출
→ 스캔 PDF: 로컬 OCR 시도 후 수동입력/OCR대기/공급사 요청 모드 제공
→ SECTION 3 성분표 후보를 별도 구조로 저장
```

스캔 PDF는 MVP에서 완벽 처리를 목표로 하지는 않지만, 제한 지원한다. 사용자가 스캔본을 올리면 앱은 다음 중 하나의 상태를 보여준다.

- `스캔본 감지`
- `OCR 진행중`
- `OCR 완료`
- `OCR 신뢰도 낮음`
- `OCR 실패`
- `수동입력 모드`
- `공급사 텍스트 PDF 요청 필요`

이 분기가 없으면 첫 시연에서 “안 되는 앱”으로 보일 가능성이 높다.

MVP의 OCR 원칙은 다음과 같다.

```text
OCR은 최종값 확정 엔진이 아니다.
OCR은 사람이 검수할 텍스트 후보를 만드는 단계다.
OCR 결과는 항상 원본 이미지 영역 또는 페이지 번호와 함께 보여준다.
OCR 신뢰도가 낮으면 자동추출 상태가 아니라 검수필요/OCR 신뢰도 낮음 상태로 표시한다.
```

OCR 엔진은 로컬 실행을 우선한다. 후보는 다음 순서로 검토한다.

1. macOS Vision OCR 또는 로컬 OCR CLI
2. Tesseract OCR
3. 추후 사내 승인된 문서 AI/OCR 엔진

외부 OCR API는 MSDS 원문 송출 이슈가 있으므로 사내 보안 승인 전에는 기본값으로 쓰지 않는다.

초기 추출 대상은 다음과 같다.

- 제품명
- 공급사
- 제조사
- 대표전화
- Email
- 용도
- 제품형태
- MSDS번호
- 최종개정일자
- 개정이력
- CAS No.
- 화학물질명
- 함유량: MIN, MAX, 단일값, 원문 표기
- GHS 유해성·위험성 문구
- 법적 규제현황 원문

SECTION 3 성분표 추출 결과는 원문 행 단위로 저장한다.

```text
row_index
raw_row_text
cas_no_candidate
chemical_name_candidate
content_min_candidate
content_max_candidate
content_single_candidate
confidence
evidence_location
review_status
```

CAS No.와 함유량이 같은 행에서 매칭되었다는 근거를 저장하지 못하면 watchlist가 오염될 수 있으므로, 성분표 추출은 단순 텍스트보다 높은 우선순위의 MVP 기능으로 둔다.

### 2.1 사내 MSDS 등록 화면 스키마

첨부된 사내 MSDS 등록 화면을 기준으로, 1차 MVP의 검수 화면은 아래 섹션 순서를 따른다.

#### 물품 기본 정보

| 사내 등록 필드 | MVP 처리 방식 | 주요 출처 |
|---|---|---|
| 공급사 | 후보 추출 + 검수 | MSDS 1번, 공급자 정보 |
| 제조사 | 후보 추출 + 검수 | MSDS 1번, 제조자 정보 |
| 대표전화 | 후보 추출 + 검수 | MSDS 1번 |
| E-mail | 후보 추출 + 검수 | MSDS 1번 |
| 제품명 | 후보 추출 + 검수 | MSDS 1번 |
| 용도 | 후보 추출 + 검수 | MSDS 1번 또는 제품 용도 |
| ITEM코드 | 수동입력 또는 내부 매핑 | 사내 기준 |
| MSDS번호 | 후보 추출 + 검수 | MSDS 제출번호/번호 |
| 제조구분 | 후보 추출 또는 수동입력 | MSDS/사용자 입력 |
| 사업장 | 수동입력 또는 기본값 | 사내 기준 |
| 최종개정일자 | 후보 추출 + 검수 | MSDS 개정일 |
| 구분 | 사용자 검수 상태 | 앱 내부 검수상태 |
| 검토자 | 사용자 입력 또는 로그인 사용자 | 앱 내부 사용자 |
| 검토의견 | 사용자 입력 | 담당자 메모 |

#### 함유량 및 법적규제 정보

첨부된 화학물질 정보 입력 스키마를 기준으로, 성분은 행 단위로 관리한다.

| 컬럼 | MVP 처리 방식 | 주요 출처 |
|---|---|---|
| CAS No. | MSDS 성분표에서 추출 + 검수 | MSDS 3번 |
| 화학물질 | MSDS 성분표에서 추출 + 검수 | MSDS 3번 |
| MIN | 함유량 범위 파싱 + 검수 | MSDS 3번 |
| MAX | 함유량 범위 파싱 + 검수 | MSDS 3번 |
| 단일 | 단일 함유량 파싱 + 검수 | MSDS 3번 |
| 특별관리물질 | CAS 기반 후보 + 검수 | KOSHA/공식 DB/내부 기준 |
| 관리대상유해물질 | CAS 기반 후보 + 검수 | KOSHA/산안법 기준 |
| 허가대상물질 | CAS 기반 후보 + 검수 | KOSHA/산안법 기준 |
| 제조금지물질 | CAS 기반 후보 + 검수 | KOSHA/산안법 기준 |
| PSM | CAS 기반 후보 + 검수 | PSM 대상물질 기준 |
| 작업환경측정 대상물질 | CAS 기반 후보 + 검수 | 산안법/KOSHA/내부 기준 |
| 노출기준설정물질 | CAS 기반 후보 + 검수 | KOSHA/고용노동부 기준 |
| 허용기준설정물질 | CAS 기반 후보 + 검수 | KOSHA/고용노동부 기준 |
| 특수건강검진대상물질 | CAS 기반 후보 + 검수 | 산안법/KOSHA/내부 기준 |
| 금지물질 | CAS 기반 후보 + 검수 | 화관법/K-REACH/공식 DB |
| 제한물질 | CAS 기반 후보 + 검수 | 화관법/K-REACH/공식 DB |
| 허가물질 | CAS 기반 후보 + 검수 | 화관법/K-REACH/공식 DB |
| 유독물질 | CAS 기반 후보 + 검수 | 화관법/K-REACH/공식 DB |
| 사고대비물질 | CAS 기반 후보 + 검수 | 화관법/K-REACH/공식 DB |

작업환경측정 대상물질과 특수건강검진대상물질은 단순 Y/N만으로 부족할 수 있으므로, 후보값에는 주기 정보를 함께 담는다.

```text
작업환경측정 대상물질: Y
작업환경측정 주기: 6개월
특수건강검진대상물질: Y
특수건강검진 주기: 12개월
```

사내 시스템 컬럼에는 주기 전용 칸이 보이지 않더라도, 앱 검수 화면에는 주기를 별도 보조 필드로 표시한다. 필요하면 사용자가 해당 값을 메모 또는 관련 칸에 옮길 수 있게 한다.

#### 유해성 위험성 정보

| 사내 등록 필드 | MVP 처리 방식 | 주요 출처 |
|---|---|---|
| 제품형태 | 후보 추출 + 검수 | MSDS 9번 또는 1번 |
| 유해성 위험성 | 후보 추출 + 검수 | MSDS 2번 GHS 분류 |

#### 개정이력

| 사내 등록 필드 | MVP 처리 방식 | 주요 출처 |
|---|---|---|
| 개정일자 | 후보 추출 + 검수 | MSDS 16번 또는 표지 |
| 개정번호/버전 | 후보 추출 + 검수 | MSDS 16번 또는 표지 |
| 개정내용 | 후보 추출 또는 수동입력 | MSDS 16번 |
| 검토 상태 | 앱 내부 상태 | 담당자 검수 |

### 3. Codex CLI 기반 후보값 구조화

MVP에서는 Mac mini를 24/7 로컬 서버로 운영하고, 로컬 앱이 Codex CLI를 호출한다.

Codex CLI에는 다음 정보를 전달한다.

- MSDS에서 추출한 텍스트/표 조각
- 사내 등록 필드 스키마
- 근거 표시와 상태값 규칙

Codex CLI는 사내 등록 화면에 맞는 JSON 후보값을 반환한다.

Codex CLI는 영구 제품 구조가 아니라 MVP 검증용 AI 실행 엔진이다. 앱은 처음부터 AI 어댑터 계층을 둬서 나중에 다른 모델이나 API로 교체할 수 있어야 한다.

### 4. CAS No. 기반 공식 출처 조회

앱은 전체 법령을 넓게 검색하지 않는다. MSDS에서 나온 CAS No.를 기본 키로 삼고, 필요하면 화학물질명, KE No., 동의어를 보조 키로 사용한다.

초기 조회 후보 출처는 다음과 같다.

- K-REACH 화학물질정보처리시스템
- KOSHA MSDS/화학물질정보
- 한국환경공단 등 공공데이터 API
- 작업환경측정 주기, 특수건강검진 주기 등을 위한 내부 기준표

가능하면 웹 브라우저 자동 조작보다 API 또는 구조화된 데이터를 우선 사용한다.

### 4.1 내부 기준표 시드 데이터

법적 규제 항목은 fixture 한두 개로는 MVP 가치가 없다. 1차 MVP 전에 최소 내부 기준표를 시드 데이터로 구축한다.

시드 데이터는 CSV로 시작하고, 앱 시작 시 SQLite로 import한다.

초기 파일 구조:

```text
data/regulatory-seeds/
  industrial-safety-special-management.csv
  industrial-safety-controlled-hazardous.csv
  industrial-safety-permission-required.csv
  industrial-safety-manufacture-prohibited.csv
  psm-substances.csv
  work-environment-measurement.csv
  exposure-limit.csv
  permissible-limit.csv
  special-health-exam.csv
  chemical-control-prohibited.csv
  chemical-control-restricted.csv
  chemical-control-permitted.csv
  toxic-substances.csv
  accident-preparedness.csv
```

각 CSV는 최소 아래 컬럼을 가진다.

```text
category
cas_no
chemical_name_ko
chemical_name_en
synonyms
threshold_text
period_value
period_unit
source_name
source_url
source_revision_date
note
```

시드 데이터의 유지보수 책임은 앱이 아니라 운영 프로세스로 둔다. 앱은 다음 정보를 보여준다.

- 기준표 버전
- 기준표 갱신일
- 출처명
- 출처 URL 또는 문서명
- 해당 기준표로 매칭된 규제 항목

MVP의 첫 데이터셋 범위는 “사업장 보유 MSDS에 등장한 CAS No.를 처리할 수 있을 만큼”으로 제한한다. 전체 법령·전체 물질 universe를 한 번에 가져오지 않는다.

### 5. 필드 상태 정책

필수 등록 필드는 조용히 빈칸으로 남기지 않는다. 모든 필드는 값 또는 다음 조치가 있는 상태값을 가져야 한다.

사용 가능한 상태값은 다음과 같다.

```text
해당
비해당
해당 후보
비해당 후보
확인필요
공급사 확인 필요
내부 기준 확인 필요
자동추출
검수필요
확인완료
보류
```

각 필드는 다음 정보를 함께 저장한다.

- 후보값
- 상태값
- 출처 유형: MSDS, 공식 DB, 내부 기준표, 사용자 입력
- 출처명
- 조회일
- 근거 문구 또는 출처 참조
- 확정되지 않은 경우 다음 조치
- 사용자 검수 상태

이 정책은 “AI가 출처 없이 억지로 확정하는 위험”과 “모르는 항목을 빈칸으로 방치하는 문제”를 동시에 줄이기 위한 것이다.

### 6. 검수 화면

검수 화면은 사내 MSDS 등록 화면 순서를 최대한 그대로 따른다.

추천 섹션은 다음과 같다.

1. 물품 기본 정보
2. 함유량 및 법적규제 정보
3. 유해성 위험성 정보
4. 개정이력

각 필드 행은 다음 구조를 가진다.

```text
등록 필드명 | 후보값 | 원문/공식 출처 근거 | 상태 | 복사 버튼
```

사용자는 다음 작업을 할 수 있다.

- 후보값 확인
- 후보값 수정
- 보류 또는 확인필요 처리
- MSDS 원문 근거 열람
- 사내 시스템 입력을 위한 값 복사

19개 규제 컬럼을 그대로 넓은 표로 펼치면 실무 검수 화면이 무너진다. 성분 검수 화면은 다음 구조를 사용한다.

```text
성분 행 요약: CAS No. / 화학물질명 / 함유량 / 전체 상태
  ├─ 산안법 그룹: 특별관리, 관리대상, 허가대상, 제조금지, PSM, 작업환경측정, 노출기준, 허용기준, 특수건강검진
  ├─ 화관법 그룹: 금지, 제한, 허가, 유독, 사고대비
  ├─ 주기 정보: 작업환경측정 주기, 특수건강검진 주기, 다음 예정일 후보
  └─ 근거: MSDS 원문, 내부 기준표, 공식 출처
```

기본 화면은 행 요약과 핵심 상태만 보여주고, 행을 펼치면 19개 항목을 검수한다. 키보드 이동과 행 단위 확인완료 처리를 지원한다.

### 7. 복사 전략

MVP에서는 필드별 복사 버튼부터 제공한다.

다만 데이터 모델과 화면 구조는 아래 확장이 가능하도록 설계한다.

- 섹션별 묶음 복사
- 성분 행 단위 복사
- 탭 구분 텍스트 복사
- 엑셀 행 형식 복사
- 사내 시스템 붙여넣기 템플릿

특히 성분/함유량 정보는 CAS No., 화학물질명, MIN, MAX, 단일값, 규제 후보값을 한 줄 단위로 옮겨야 할 가능성이 높으므로 행 단위 복사를 염두에 둔다.

성분 행 단위 복사 순서는 첨부된 화학물질 정보 입력 스키마를 기준으로 한다.

```text
CAS No. | 화학물질 | MIN | MAX | 단일 | 특별관리물질 | 관리대상유해물질 | 허가대상물질 | 제조금지물질 | PSM | 작업환경측정 대상물질 | 노출기준설정물질 | 허용기준설정물질 | 특수건강검진대상물질 | 금지물질 | 제한물질 | 허가물질 | 유독물질 | 사고대비물질
```

주기 정보가 필요한 항목은 앱 내부에서는 별도 필드로 관리하되, 사내 시스템 입력 컬럼에 직접 들어가지 않는 경우 근거/메모 영역에 함께 보여준다.

### 8. 관리자동화 기반

검수 완료된 MSDS는 단순히 사내 시스템에 옮겨 입력하고 끝나는 데이터가 아니다. 앱 내부에는 다음 운영 데이터로 누적한다.

- 제품별 MSDS 원본과 최신 검수 상태
- 제품별 구성성분과 CAS No.
- 공급사와 최신본 요청 필요 여부
- 사용 현장, 사용 목적, 보관 장소
- 제출번호 누락, 개정일 오래됨, CAS No. 누락, 영업비밀 성분 등 검토 필요 항목

1차 MVP에서 관리자동화는 아래 수준까지 포함한다.

```text
검수 완료 MSDS 저장
→ 제품/성분/공급사 데이터 생성
→ 제품-현장 연결
→ 검토 필요 상태 표시
→ 현장별 또는 공급사별 목록 조회
```

엑셀 자동 출력은 MVP의 필수 첫 화면은 아니지만, 데이터 구조는 관리대장 출력이 가능하도록 설계한다.

초기 산출물 후보:

- 전체 MSDS 목록
- 제품별 성분 목록
- 현장별 사용 제품 목록
- 공급사별 최신본 요청 대상
- 제출번호/CAS No./영업비밀 확인 필요 목록

1차 MVP에서 관리자동화 화면은 빈 화면이면 안 된다. 최소 다음 큐를 제공한다.

- 검수필요 큐
- 확인필요 큐
- 공급사 확인 필요 큐
- 내부 기준 확인 필요 큐
- 사내 시스템 등록 대기 큐
- 사내 시스템 등록 완료 목록

검수 완료와 사내 시스템 등록 완료는 별도 상태로 관리한다.

```text
추출완료
검수중
검수완료
등록대기
등록완료
공급사확인대기
내부기준확인대기
```

초기 도입을 위해 일괄 import 경로를 둔다.

- 기존 관리대장 CSV import
- 사업장/공정/ITEM코드 마스터 CSV import
- 기존 MSDS PDF 일괄 업로드
- import 결과에서 매칭 실패 항목 큐 생성

### 9. 변경감시 기반

1차 MVP에서 변경감시는 완성 기능이 아니라 **watchlist 기반을 만드는 것**까지 포함한다.

MSDS에서 추출되고 검수된 CAS No.는 자동으로 사업장 관심 CAS No. 목록에 들어간다.

```text
검수 완료 성분
→ CAS No. watchlist 저장
→ 관련 제품과 현장 연결
→ 마지막 공식 출처 조회 결과 저장
→ 향후 재조회 시 변경 후보 비교 가능
```

1차 MVP에서 표시할 수 있는 변경감시 관련 상태는 다음과 같다.

- 공식 출처 최초 조회 완료
- 공식 출처 조회 필요
- 출처 조회 실패
- 공급사 확인 필요
- 내부 기준 확인 필요

주기적 자동 재조회와 변경 후보 알림은 2차 기능으로 둔다. 다만 1차 데이터 모델에 마지막 조회일, 출처, 결과 해시 또는 요약값을 저장해 이후 변경감시로 자연스럽게 이어지게 한다.

외부 공식 DB 변경감시보다 먼저, 제품 자체의 MSDS 개정본 비교를 1차 MVP에 포함한다.

새 MSDS가 같은 제품에 업로드되면 앱은 이전 검수본과 비교해 다음 변경 후보를 보여준다.

- MSDS번호 변경
- 최종개정일자 변경
- CAS No. 추가/삭제
- 화학물질명 변경
- 함유량 MIN/MAX/단일 변경
- 영업비밀 여부 변경
- 유해성 위험성 문구 변경
- 법적 규제현황 원문 변경

이 비교 결과는 `Product Revision Diff`로 저장하고, 사용자가 변경 내용을 검수한 뒤 제품의 최신본으로 승격한다.

작업환경측정과 특수건강검진은 주기 정보가 핵심 가치다. MVP는 다음 예정일 계산까지 포함한다.

```text
대상 여부
주기 값
주기 단위
마지막 실시일
다음 예정일 후보
상태: 예정 / 임박 / 초과 / 확인필요
```

마지막 실시일은 MSDS에서 나오지 않으므로 사용자가 입력하거나 기존 관리대장 import에서 가져온다.

## 데이터 모델 개념

### Document

- document_id
- file_name
- file_hash
- upload_date
- processing_status
- source_pdf_path

### Registration Field

- field_id
- document_id
- section
- field_key
- field_label
- candidate_value
- normalized_value
- status
- source_type
- source_name
- source_url_or_reference
- lookup_date
- evidence_text
- evidence_location
- next_action
- user_review_status
- user_note

### Component

- component_id
- document_id
- cas_no
- chemical_name
- content_min
- content_max
- content_single
- content_original_text
- trade_secret_flag
- row_copy_text
- review_status

### Product

- product_id
- product_name
- supplier
- manufacturer
- item_code
- msds_number
- current_document_id
- current_revision_id
- latest_revision_date
- review_status
- registration_status
- latest_request_status

### Product Revision

- revision_id
- product_id
- document_id
- msds_number
- revision_date
- revision_version
- source_file_hash
- promoted_at
- promoted_by
- review_status

### Product Revision Diff

- diff_id
- product_id
- previous_revision_id
- new_revision_id
- change_type
- field_key
- previous_value
- new_value
- evidence_text
- review_status

### Site

- site_id
- site_name
- process_name
- department
- owner
- note

### Product Site

- product_site_id
- product_id
- site_id
- usage_purpose
- storage_location
- monthly_usage
- posted_msds_location
- active_flag

### Regulatory Match

- match_id
- component_id
- seed_id
- category
- candidate_value
- period_value
- period_unit
- status
- source_name
- source_url_or_reference
- lookup_date
- evidence_text
- next_action
- reviewer_decision

### Regulatory Seed

- seed_id
- category
- cas_no
- chemical_name_ko
- chemical_name_en
- synonyms
- threshold_text
- period_value
- period_unit
- source_name
- source_url
- source_revision_date
- note

### Imported Master

- import_id
- import_type
- file_name
- imported_at
- row_count
- failed_row_count
- status

### Audit Log

- audit_id
- entity_type
- entity_id
- action
- previous_value
- new_value
- actor
- created_at
- reason

### Backup Snapshot

- snapshot_id
- snapshot_path
- created_at
- database_hash
- status

### Watchlist Item

- watchlist_id
- cas_no
- chemical_name
- related_component_ids
- related_product_ids
- related_site_ids
- source_name
- last_lookup_date
- last_result_hash
- last_result_summary
- watch_status

## 리스크 관리

### 이전 실패 앱과의 차이

이전 법령 조회 앱은 자연어 질문으로 너무 넓은 법령 데이터를 검색하려 했기 때문에 무거워지고, 원하는 결과를 안정적으로 가져오기 어려웠다.

이번 MVP는 다음 원칙으로 그 실패를 피한다.

- 열린 질문이 아니라 MSDS 문서에서 시작한다.
- CAS No.를 기본 키로 사용한다.
- 승인된 출처만 조회한다.
- 사내 등록 화면의 고정 필드만 채운다.
- 법령 해석 답변이 아니라 출처 기반 후보값과 상태값을 반환한다.
- 변경감시는 전체 DB 감시가 아니라 사업장 CAS No. watchlist만 감시한다.

### AI 신뢰 경계

AI가 해도 되는 일:

- 추출된 텍스트 구조화
- 후보값 제안
- 공식 출처 조회 결과를 등록 필드에 맞춰 요약
- 확인필요 사유와 다음 조치 설명

AI가 하면 안 되는 일:

- 법적 최종판정
- 출처 invent
- 불확실한 항목을 확인완료로 표시
- 승인되지 않은 웹사이트를 임의 검색
- 불확실성을 숨기고 필드를 비워두기

### 보안, 백업, 감사로그

MVP 시작 전에 사내 보안 검토를 먼저 통과해야 한다. Codex CLI가 외부 LLM으로 MSDS 원문 또는 추출 텍스트를 송출하는 구조라면, 다음 중 하나가 확인되어야 한다.

- 사내 정보보안 정책상 MSDS 텍스트 외부 송출 허용
- MSDS 원문 대신 최소 추출 조각만 송출 허용
- 영업비밀/공급사 정보 마스킹 후 송출 허용
- 외부 송출 불가, 로컬 LLM 또는 수동 구조화 모드 사용

보안 승인이 나기 전에는 Codex CLI를 운영 MVP의 기본 엔진으로 확정하지 않는다. AI 어댑터는 다음 모드를 지원한다.

```text
fixture
codex_cli
local_only_manual
local_llm_future
```

검수 완료 데이터는 점검 대응 자료이므로 백업과 감사로그를 MVP에 포함한다.

- SQLite 일일 백업
- 백업 파일 해시 기록
- 최근 백업 상태 대시보드 표시
- 사용자가 값을 확인/수정/등록완료 처리할 때 감사로그 기록
- 누가, 언제, 어떤 값을, 무엇에서 무엇으로 바꿨는지 저장

Mac mini 단일 장애점은 MVP에서는 허용하되, 백업 없는 단일 SQLite는 허용하지 않는다.

### 영업비밀 성분 처리

CAS No.가 없거나 성분명이 영업비밀/대체명칭인 경우에는 추정하지 않는다. 대신 다음 상태로 관리한다.

```text
CAS No.: 공급사 확인 필요
화학물질명: 영업비밀
함유량: 원문 표기 유지
규제 항목: 확인필요
다음 조치: 공급사에 CAS No./함유량 범위/영업비밀 승인 여부 확인 요청
```

영업비밀 성분은 공급사 요청 큐에 자동 포함한다.

## MVP 성공 기준

1. 사용자가 텍스트 기반 MSDS PDF를 업로드하면 사내 등록 화면에 필요한 후보값을 받을 수 있다.
2. MSDS 3번 성분표에서 CAS No., 화학물질명, 함유량이 행 단위 근거와 함께 추출된다.
3. 스캔본 PDF는 실패가 아니라 로컬 OCR 시도 후 OCR 완료/OCR 신뢰도 낮음/수동입력/공급사 텍스트 PDF 요청 상태로 분기된다.
4. 각 필드에 후보값, 근거, 상태가 표시된다.
5. 사용자는 사내 등록 화면과 같은 순서로 값을 검수하거나 수정할 수 있다.
6. CAS No. 기반 법적 규제 항목은 내부 기준표 또는 공식 출처 기반 후보를 반환한다.
7. fixture가 아닌 CSV seed 기반 내부 기준표로 최소 규제 카테고리 매칭이 동작한다.
8. 검수 완료된 MSDS가 제품, 개정본, 성분, 공급사, 현장 데이터로 저장된다.
9. 같은 제품의 새 MSDS를 올리면 이전 개정본과 CAS/함유량/유해성 변경 후보가 표시된다.
10. 검수된 CAS No.가 watchlist에 저장되고 관련 제품/현장과 연결된다.
11. 검수필요, 확인필요, 공급사 확인 필요, 내부 기준 확인 필요, 등록대기 큐를 볼 수 있다.
12. 작업환경측정/특수건강검진 대상은 주기와 다음 예정일 후보를 관리할 수 있다.
13. 사용자의 확인/수정/등록완료 처리는 감사로그에 남는다.
14. SQLite 데이터는 일일 백업과 백업 상태 확인이 가능하다.
15. 앱은 전체 법령 검색을 하지 않고 Mac mini에서 실무적으로 사용할 수 있을 만큼 가볍게 동작한다.

## 남은 확인 질문

1. 사내 등록 화면의 정확한 필드 중 필수, 선택, 조건부 필드는 무엇인가?
2. 각 법적 규제 항목별로 어떤 공식 출처를 우선 출처로 볼 것인가?
3. K-REACH 또는 관련 공공 API에서 필요한 항목을 프로그램으로 조회할 수 있는가?
4. 작업환경측정 주기와 특수건강검진 주기는 어떤 내부 기준표 또는 공식 기준으로 관리할 것인가?
5. 담당자가 검수할 때 필요한 최소 근거 형식은 무엇인가?
6. 제품-현장 연결은 최초 등록 시 필수로 입력할 것인가, 아니면 등록 후 별도 관리 화면에서 입력할 것인가?
7. 1차 MVP에서 반드시 필요한 관리 목록은 전체 MSDS, 현장별 목록, 공급사 요청 대상 중 무엇인가?
8. 사내 보안팀이 Codex CLI 또는 외부 LLM으로 MSDS 추출 텍스트 송출을 허용하는가?
9. 기존 MSDS 관리대장, 사업장/공정/ITEM코드 마스터 파일이 어떤 양식으로 존재하는가?
10. 내부 기준표 시드의 1차 출처와 유지보수 담당자는 누구인가?
