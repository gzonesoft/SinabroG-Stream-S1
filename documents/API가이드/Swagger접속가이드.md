# 🚁 AH 드론 캡처 API - Swagger UI 접속 가이드

## 1. Swagger UI 소개

Swagger UI는 브라우저에서 직접 API를 테스트하고 문서를 확인할 수 있는 대화형 도구입니다. 
개발자가 API 함수를 빠르게 이해하고 테스트할 수 있도록 준비했습니다.

## 2. 접속 방법

### 2.1 로컬 Swagger UI 접속

#### 방법 1: 파일 직접 열기
```bash
# 터미널에서 실행
open /Users/gzonesoft/supabase/public/swagger-ui.html

# 또는 브라우저에서 직접 열기
file:///Users/gzonesoft/supabase/public/swagger-ui.html
```

#### 방법 2: 로컬 웹서버 실행
```bash
# Python 3 사용
cd /Users/gzonesoft/supabase/public
python3 -m http.server 8080

# 브라우저에서 접속
http://localhost:8080/swagger-ui.html
```

#### 방법 3: Node.js 사용
```bash
# http-server 설치 (최초 1회)
npm install -g http-server

# 서버 실행
cd /Users/gzonesoft/supabase/public
http-server -p 8080

# 브라우저에서 접속
http://localhost:8080/swagger-ui.html
```

### 2.2 Docker를 통한 Swagger 서비스

```bash
# Swagger UI 컨테이너 실행
docker run -d \
  --name ah-swagger \
  -p 8081:8080 \
  -e SWAGGER_JSON=/app/swagger.json \
  -v /Users/gzonesoft/supabase/public:/app \
  swaggerapi/swagger-ui

# 브라우저에서 접속
http://localhost:8081
```

## 3. Swagger UI 사용법

### 3.1 첫 화면 구성

Swagger UI에 접속하면 다음과 같은 화면이 표시됩니다:

```
┌─────────────────────────────────────────┐
│    🚁 AH 드론 캡처 API                   │
│    스트림 캡처 데이터 관리 RESTful API    │
├─────────────────────────────────────────┤
│ 🔑 API 인증 정보                         │
│ Base URL: http://localhost:17321        │
│ API Key: eyJhbGciOiJIUzI1N...          │
│ [API Key 복사]                          │
├─────────────────────────────────────────┤
│ 📂 캡처 관리                             │
│   POST /ah_create_capture               │
│   POST /ah_get_captures                 │
│   POST /ah_update_capture               │
│   POST /ah_delete_capture               │
│                                         │
│ 📂 배치 작업                             │
│   POST /ah_batch_create_captures        │
│                                         │
│ 📂 검색                                  │
│   POST /ah_search_captures              │
│                                         │
│ 📂 통계                                  │
│   POST /ah_get_capture_stats            │
└─────────────────────────────────────────┘
```

### 3.2 API 테스트 단계

#### Step 1: API Key 설정
1. 상단의 **[API Key 복사]** 버튼 클릭
2. API Key가 자동으로 모든 요청에 포함됩니다

#### Step 2: 엔드포인트 선택
1. 테스트할 API 함수를 클릭하여 확장
2. **[Try it out]** 버튼 클릭

#### Step 3: 파라미터 입력
```json
{
  "p_capture_id": "test_001",
  "p_device_id": "DJI_001",
  "p_timestamp": "2025-09-13T10:00:00Z",
  "p_stream_key": "stream_test",
  "p_title": "테스트 캡처",
  "p_drone_data": {
    "lat": 37.5665,
    "lng": 126.9780,
    "alt": 50,
    "heading": 90
  }
}
```

#### Step 4: 실행 및 결과 확인
1. **[Execute]** 버튼 클릭
2. 응답 코드와 본문 확인
3. curl 명령어 복사 가능

### 3.3 주요 테스트 시나리오

#### 시나리오 1: 캡처 생성 → 조회 → 삭제
```javascript
// 1. 캡처 생성
POST /rest/v1/rpc/ah_create_capture
{
  "p_capture_id": "demo_001",
  "p_device_id": "TEST_DEVICE",
  "p_timestamp": "2025-09-13T10:00:00Z",
  "p_stream_key": "demo_stream",
  "p_title": "데모 캡처"
}

// 2. 캡처 조회
POST /rest/v1/rpc/ah_get_captures
{
  "p_stream_key": "demo_stream"
}

// 3. 캡처 삭제
POST /rest/v1/rpc/ah_delete_capture
{
  "p_capture_id": "demo_001"
}
```

#### 시나리오 2: 배치 업로드 테스트
```javascript
POST /rest/v1/rpc/ah_batch_create_captures
{
  "p_captures": [
    {
      "id": "batch_001",
      "deviceId": "DEVICE_001",
      "timestamp": "2025-09-13T10:00:00Z",
      "streamKey": "batch_test",
      "title": "배치 캡처 1"
    },
    {
      "id": "batch_002",
      "deviceId": "DEVICE_001",
      "timestamp": "2025-09-13T10:01:00Z",
      "streamKey": "batch_test",
      "title": "배치 캡처 2"
    }
  ]
}
```

## 4. 개발자 도구 연동

### 4.1 Postman Import
1. Swagger UI에서 **OpenAPI 3.0** 스펙 다운로드
2. Postman > Import > OpenAPI 3.0 선택
3. 컬렉션 자동 생성

### 4.2 cURL 명령어 생성
Swagger UI에서 테스트 후 **curl** 탭을 클릭하면 명령어가 자동 생성됩니다:

```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_captures" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "p_limit": 10,
    "p_stream_key": "test"
  }'
```

### 4.3 JavaScript 코드 생성
```javascript
// Swagger UI에서 생성된 요청을 JavaScript로 변환
const response = await fetch("http://localhost:17321/rest/v1/rpc/ah_get_captures", {
    method: "POST",
    headers: {
        "apikey": "your-api-key",
        "Authorization": "Bearer your-api-key",
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        p_limit: 10,
        p_stream_key: "test"
    })
});

const data = await response.json();
console.log(data);
```

## 5. 문제 해결

### 5.1 CORS 오류
브라우저에서 CORS 오류가 발생하는 경우:

```javascript
// Chrome 실행 (Mac)
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --args --user-data-dir="/tmp/chrome_dev_test" \
  --disable-web-security
```

### 5.2 API Key 인증 실패
```javascript
// 올바른 헤더 설정 확인
headers: {
    'apikey': SUPABASE_ANON_KEY,  // 필수
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,  // 필수
    'Content-Type': 'application/json'
}
```

### 5.3 로컬 파일 접근 오류
파일 프로토콜(file://)에서 실행 시 제한사항:
- localStorage 접근 불가
- 일부 브라우저 API 제한

**해결책**: 로컬 웹서버 사용 (위 2.1 참조)

## 6. 추가 리소스

### 6.1 관련 파일 위치
```
/Users/gzonesoft/supabase/
├── public/
│   └── swagger-ui.html          # Swagger UI 페이지
├── docker/volumes/swagger/
│   └── openapi.json             # OpenAPI 스펙
└── migrations/
    └── 20250913130000_ah_capture_api_functions.sql  # API 함수 정의
```

### 6.2 유용한 도구
- **Swagger Editor**: https://editor.swagger.io
- **Postman**: https://www.postman.com
- **Insomnia**: https://insomnia.rest
- **Thunder Client** (VS Code 확장)

### 6.3 API 문서
- 개발자 가이드: `/Users/gzonesoft/SinabroG-Stream-S1/documents/AH-드론캡처-API-개발자가이드.md`
- DJI 로그 API: `/Users/gzonesoft/supabase/documents/dji-log-api-curl-commands.md`

## 7. 보안 주의사항

### 7.1 API Key 관리
- ⚠️ API Key를 GitHub에 커밋하지 마세요
- ⚠️ 프로덕션 Key는 환경 변수로 관리
- ⚠️ 클라이언트 사이드에서는 anon key만 사용

### 7.2 테스트 데이터
- 테스트 시 실제 고객 데이터 사용 금지
- 테스트용 device_id: `TEST_DEVICE_001`
- 테스트용 stream_key: `test_stream`

## 8. 지원 및 문의

### 기술 지원
- 📧 이메일: support@ah-drone.com
- 📞 전화: 02-1234-5678
- 💬 Slack: #ah-api-support

### 업데이트 정보
- GitHub: https://github.com/ah-drone/capture-api
- 최신 버전: v1.0.0
- 업데이트 주기: 매주 화요일

---

**작성일**: 2025-09-13  
**버전**: 1.0.0  
**작성자**: AH 드론 개발팀

© 2025 AH Drone Systems. All rights reserved.