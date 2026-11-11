# 손그림 곤충도감용 원천 데이터

국립수목원 **국가생물종지식정보시스템 곤충도감**의 공개 목록과 상세 페이지에서 수집한 데이터입니다.
최종 건수와 완료 여부는 [`collection-report.json`](collection-report.json), 검증 결과는 [`validation-report.json`](validation-report.json)에 기록합니다.

2026-11-04(UTC) 수집·검토 결과: 전체 **5,509건** 중 현재 제작 목록은 **3,303건**입니다. 최초 갤러리 이미지 보유 항목은 3,328건이었으나, 전체 모습 설명이 없는 41종의 이미지 58개를 육안 확인해 해부 도판·해부 부위 사진만 있는 23종과 이미지 주소가 모두 404인 1종을 분리했습니다. 2026-11-05 생성 전 확인에서 전신 이미지 주소와 썸네일이 사이트 로고이고 나머지가 해부 도판인 굵은수염알락명나방 1종을 추가 분리했습니다. 갤러리가 없는 2,181종까지 포함한 제외·보류 합계는 **2,206건**입니다. 현재 목록의 갤러리 이미지 참조는 **5,330개**, 상세 페이지 수집 오류는 **0건**입니다. 모든 이미지에 대한 전수 육안·HTTP 검사를 마쳤다는 의미는 아니며, 그림 생성 전에 원본을 계속 확인합니다. 한국어 이름이 없는 두 항목은 학명을 표시 이름으로 사용합니다.

## 사용할 파일

| 파일 | 용도 |
| --- | --- |
| `catalog.json` | 목록·검색·분류 필터용 인덱스. 상세 설명은 포함하지 않습니다. |
| `insects/<도감ID>.json` | 곤충 한 종의 전체 정보. 상세 화면에서 필요한 파일만 불러옵니다. |
| `insects.json` | 사진이 있는 모든 곤충의 상세 정보를 담은 통합 JSON. |
| `insects.csv` | 엑셀에서 확인할 수 있는 UTF-8 BOM CSV. 이름, 학명, 분류, 특징, 생태, 분포, 대표 사진·출처 URL. |
| `illustration-prompt.json` | 사용자와 정한 색연필 자연도감 삽화 프롬프트. |
| `illustration-jobs.jsonl` | 곤충별 대표 사진과 향후 그림 저장 경로를 연결한 작업 목록. 한 줄이 한 곤충입니다. |
| `source-index.json` | 원본 목록 전체의 ID와 사진 표시 유무. 수집 범위를 감사하기 위한 파일입니다. |
| `excluded.json` | 실제 상세 갤러리에 사진이 없어 제외한 항목과 이유. |
| `photo-review.json` | 최초 41종과 생성 전 추가 확인 항목의 이미지 분류 및 포함·제외·접근불가 검토 근거. |
| `excluded-records/` | 해부 자료만 있거나 이미지 접근이 안 되어 제작 목록에서 분리한 25종의 원문 정보. |
| `illustration-progress.json` | 실제 저장·연결된 그림 수와 대기 수. 전체 완료 여부. |
| `illustration-run.json` | 현재 추가 생성 작업의 대상 ID, 교체 내역, 실제 완료 수. |
| `illustration-run-validation.json` | 해당 추가 생성 작업이 끝난 뒤 기록하는 PNG·해시 및 데이터 연결 검증 결과. |
| `illustration-review.json` | 생성본의 다리 수·표본 핀 등 육안 보정 후보와 처리 결과. |
| `errors.json` | 수집 실패 항목. 정상 완료 시 빈 배열입니다. |
| `image-access-sample.json` | 일부 원본 사진 URL의 HTTP 응답과 이미지 파일 시그니처 검증 결과. 전체 사진 검사 결과가 아닙니다. |

웹페이지에 노출할 데이터는 `catalog.json`, `insects/`, 또는 `insects.json`입니다. 확인된 해부 자료 전용 항목과 접근불가 보류 항목은 이 파일들에 포함하지 않습니다.

## 포함 기준과 사진

- 원본 도감의 전체 목록을 순회한 다음 **모든 항목의 상세 페이지**를 확인합니다.
- 상세 페이지 `이미지 갤러리`에 이미지 링크가 있는 항목을 먼저 수집하고, 곤충 외형 사진 없이 해부 자료만 있는 것으로 확인된 항목은 제외합니다. HTTP 접근불가는 별도 이유로 보류합니다.
- `이미지정보가 없습니다` 대체 그림, 관련 식물 사진, 표본정보에만 있는 사진은 도감 사진으로 세지 않습니다.
- `images`에는 원본 갤러리 이미지 전체의 원본·표시용·썸네일 URL과 설명, 촬영 정보를 보존합니다. 곤충 사진과 함께 올라온 해부 도판도 원문 자료로 남아 있습니다. 기존 필드 `gallery_photos`와 `photo_count`는 호환을 위해 유지하며, 실제 의미는 갤러리 **이미지 참조 수**입니다.
- 원본 링크와 메타데이터를 저장하며, 제작·검토에 필요한 원본만 저장소 밖 캐시에 다운로드합니다. 모든 이미지 URL의 HTTP 응답을 검사했다는 뜻은 아닙니다. 생성된 손그림 PNG는 저장소의 `assets/illustrations/`에 보관합니다.
- 원문 `representative_image_id`는 사이트의 첫 이미지입니다. 손그림의 `illustration.reference_image_id`와 작업 목록은 전체 모습 사진을 우선하며, 검색 목록의 썸네일도 이 참조에 맞춥니다. 화질·성별·시점은 생성 전에 육안으로 확인합니다.

## 곤충별 JSON 필드

| 필드 | 내용 |
| --- | --- |
| `id` | 원본 도감 ID. 이름이 바뀌어도 파일명과 그림 연결 키로 사용합니다. |
| `name_ko`, `scientific_name`, `family_ko` | 국명, 명명자를 포함한 원본 학명, 과 이름. |
| `display_name` | 화면 표시 이름. 국명이 비어 있는 원본 항목은 학명을 사용하며, 한국명을 임의로 만들지 않습니다. |
| `taxonomy` | 목·상과·과·아과·족·속·아속의 한국명과 라틴명. 원본에 있는 계급만 포함합니다. |
| `taxonomy_text` | 분류학적 위치의 원문 전체. 구조화하기 어려운 표기도 보존합니다. |
| `basic_information` | 상세 페이지 기본정보를 원본 항목명으로 저장합니다. |
| `information` | 특징·암수 성충·유충·알·번데기·생태·습성·출현시기·월동·분포·특기사항·방제법·참고사항의 편의 필드. 없는 내용은 `null`입니다. |
| `sections` | 원문 소제목과 본문을 순서대로 모두 보존합니다. 새로운 항목이 생겨도 누락되지 않게 이 배열을 상세 화면에 사용할 수 있습니다. |
| `images` | 사진별 ID, URL, 설명, 촬영 정보. |
| `representative_image_id` | 대표 사진 ID. |
| `specimen_examples` | 상세 페이지에 제시된 표본 예시의 ID와 설명. 전체 표본 목록을 별도로 수집하지는 않았습니다. |
| `related_species` | 상세 페이지의 관련 생물종. |
| `illustration` | 그림 생성 상태, 사진 참조 ID, 그림 경로와 스타일 ID. 미생성은 `pending` / `null`, 생성은 `generated`, 사용자 승인 완료는 `approved`입니다. |
| `source` | 원본 상세 URL, 출처명, UTC 수집시각, 원본 HTML SHA-256, 이용정책 링크. |

원문을 임의로 요약하거나 학명·생태 정보를 교정하지 않았습니다. HTML 태그와 불필요한 공백만 정리하고 문단·줄바꿈을 보존했습니다. 항목별 정보량 차이는 원본의 차이입니다.

## 손그림과 연결하기

1. `illustration-jobs.jsonl`의 `reference_image_url`을 참고 이미지로 사용합니다.
2. `illustration-prompt.json`의 프롬프트로 그림을 생성합니다.
3. 생성한 파일을 작업 목록의 `suggested_output_path` 등에 저장합니다.
4. 해당 곤충과 목록 인덱스의 `illustration.image_path`를 채우고 `status`를 갱신합니다.

승인된 공통 스타일은 `gentle-colored-pencil-v1`입니다. `assets/style-reference/colored-pencil-approved.png`를 원본 곤충 사진과 함께 참고합니다. 단순한 형태와 고운 흰 종이결, 부드러운 색연필 중첩을 유지하며 곤충마다 원본의 색을 사용합니다. 사용자가 추가한 규칙은 “곤충의 다리가 접히거나 잘리는 등 제대로 표시되지 않는다면 보이는 다리의 모습을 참고하여 정상적으로 6개의 다리를 그린다”입니다. 더듬이와 다른 몸 구조를 다리로 세지 않습니다. 생성 수는 `illustration-progress.json`을 확인합니다. `generated`는 실제 PNG 생성·연결 상태이며 사용자가 승인한 `approved`와 구분합니다.

추가 300장 작업으로 누적 450장을 저장했으며, 그 작업 및 검증 기록은 `illustration-runs/additional-300-total-450/`에 보존했습니다. 현재는 이어서 550장을 추가해 누적 1,000장을 목표로 작업 중입니다. 현재 실제 완료 수는 `illustration-progress.json`과 `illustration-run.json`을 확인합니다. 새 작업의 파일 검증 결과는 완료 후 `illustration-run-validation.json`에 기록합니다. 손상 표본을 복원한 부분과 육안 재검토 사항은 `illustration-review.json`에 남겼으며, 파일 검증 통과가 종 동정·해부학적 정확도 승인을 뜻하지는 않습니다.

`ZOBL0079`(깔따구꽃하늘소)는 사진이 하늘소 학명·형태 설명과 맞지 않는 파리류 형태이므로 원문을 보존한 채 그림 생성을 보류했습니다. 해당 `illustration.reference_review_status`는 `blocked`이며 생성 준비 도구에서 건너뜁니다. 표시용 웹페이지에서도 이 상태의 원본 썸네일은 정확한 사진으로 확인하기 전 노출하지 마세요. 이 항목은 제작 데이터 3,303건에 남아 있고, 해부 도판·접근불가로 분리한 25종과 구분됩니다.

수집을 재실행해도 저장된 스타일 프롬프트를 덮어쓰지 않으며, 원본 사진 참조가 일치하는 기존 그림 상태를 보존합니다. 육안 제외 결정도 같은 갤러리 URL 구성이 유지되는 동안 적용합니다. 원본 이미지 구성이 바뀌면 다시 검토합니다. 생성 그림의 곤충 형태와 무늬는 도감에 사용하기 전에 원본과 대조해야 합니다.

## 수집 재개·갱신과 검증

```sh
cd /workspace/insectbook
python3 -m venv /workspace/.insectbook-venv
/workspace/.insectbook-venv/bin/python -m pip install -r scripts/requirements-collect.txt
/workspace/.insectbook-venv/bin/python scripts/collect_nature.py
/workspace/.insectbook-venv/bin/python -m unittest discover -s tests -v
/workspace/.insectbook-venv/bin/python scripts/validate_data.py
```

캐시는 저장소 밖 `/workspace/.cache/insectbook/nature`에 보관합니다. 중단 후 같은 명령을 실행하면 완료 항목을 재사용하고 오류 항목을 재시도합니다. 네트워크 요청은 동시 8개 이하, 요청 시작 간격 최소 0.25초로 제한하고 일시 오류에는 지연 후 재시도합니다. 실패가 남아 있으면 완료로 표시하지 않습니다.

- `--reparse`: 저장된 HTML을 다시 해석해 JSON을 재생성합니다. 캐시가 있으면 네트워크 요청을 반복하지 않습니다.
- `--refresh`: 원본을 다시 요청합니다. 전체 갱신은 시간이 걸리므로 필요한 경우에만 사용합니다.
- `--lists-only`: 전체 목록만 수집합니다.

원본의 레코드 수와 고유 ID 수, 포함·제외 항목의 합계, 사진 링크, 종별·통합 JSON의 일치, CSV 행 수, 그림 작업 수를 검증합니다. 테스트 fixture는 실제 공개 도감의 사진 있는 항목과 없는 항목에서 추린 HTML입니다.

## 출처와 이용 조건

- 출처: [국립수목원 국가생물종지식정보시스템 곤충도감](https://www.nature.go.kr/kbi/insct/pilbk/selectInsctPilbkGnrlList.do)
- 원본의 [정보이용신청 및 저작권정책 링크](https://www.nature.go.kr/kbi/us/open/KBI_2006_030000.do)
- 원본 사이트는 국립수목원의 저작권 안내를 표시합니다. 개별 사진의 이용허락이나 공개 라이선스는 확인되지 않아 `source.license`를 `null`로 저장했습니다. 이 데이터 저장은 사진·설명의 공개 재배포나 변형 이용에 대한 허락을 의미하지 않습니다.

인용·표시·허락 검토에 필요한 원본 URL과 촬영자 정보를 유지하세요.
