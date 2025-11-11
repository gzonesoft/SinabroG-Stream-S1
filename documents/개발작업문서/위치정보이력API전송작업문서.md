# 📍 위치정보 이력 API 전송 작업 문서

## 📋 작업 개요
localStorage에 저장된 위치정보 이력 데이터를 고객사 API(AH 드론 캡처 API)로 전송하는 기능 구현

## 🎯 작업 목표
1. localStorage의 위치정보 데이터를 API로 마이그레이션
2. 실시간 위치정보를 API로 전송하는 시스템 구축
3. 기존 로그 파일 데이터도 API로 백업

## 📊 현재 상황 분석

### 1. 위치정보 데이터 구조
```json
{
  "timestamp": "2025. 09. 13. 11:16:09",
  "LATITUDE": 36.5869714666574,
  "LONGITUDE": 127.2413056146838,
  "ALTITUDE": 74,
  "SPEED": 0,
  "AZIMUTH": -156,
  "FLIGHT_MODE": "GPS_NORMAL",
  "BATTERY_LEVEL": 65,
  "DEVICE_ID": "DJI_DEVICE_001",
  "TIME_KST": "2025-09-13 11:16:08"
}
```

### 2. 저장 위치
- **localStorage**: `dronePositionHistory` 키에 JSON 배열로 저장
- **로그 파일**: `/position_log/position_YYYYMMDD_HH.log` 형식으로 시간별 저장
- **실시간 데이터**: `data_overly.json` 파일에 현재 위치 저장

### 3. API 엔드포인트 (사용 가능)
- `ah_create_capture`: 캡처 저장 (위치정보 포함)
- `ah_batch_create_captures`: 배치 저장
- **필요한 새 엔드포인트**: `ah_save_position_history` (위치 이력 전용)

## ✅ 작업 체크리스트

### Phase 1: API 클라이언트 준비
- [ ] 위치정보 전송용 API 클라이언트 모듈 생성
  - 파일명: `/public/js/position-api-client.js`
  - 기능: 위치정보 전송, 배치 전송, 오류 처리
- [ ] API 설정 파일 생성
  - 파일명: `/public/js/position-api-config.js`
  - 내용: API URL, 인증 키, 전송 간격 설정

### Phase 2: 데이터 마이그레이션 도구
- [ ] localStorage 데이터 추출 함수 작성
  ```javascript
  function extractPositionHistory() {
    const history = JSON.parse(localStorage.getItem('dronePositionHistory') || '[]');
    return history;
  }
  ```
- [ ] 로그 파일 파싱 도구 작성
  - 파일명: `/migrate-position-history.js`
  - 기능: 로그 파일 읽기 → JSON 파싱 → API 전송
- [ ] 배치 전송 함수 구현
  ```javascript
  async function batchSendPositions(positions, batchSize = 100) {
    // 100개씩 묶어서 전송
  }
  ```

### Phase 3: 실시간 전송 시스템
- [ ] 서버 측 위치정보 수집기 수정
  - 파일: `/server.js`
  - 수정 내용: 위치 업데이트 시 API 전송 추가
- [ ] 클라이언트 측 실시간 전송
  - 파일: `/public/viewer.js`, `/public/camera.html`
  - 수정 내용: 위치 업데이트 시 API 호출
- [ ] 전송 실패 시 재시도 로직
  ```javascript
  class PositionQueue {
    constructor() {
      this.queue = [];
      this.retryCount = 3;
    }
    async sendWithRetry(position) {
      // 재시도 로직
    }
  }
  ```

### Phase 4: API 스키마 설계
- [ ] 위치정보 전용 테이블 생성 요청
  ```sql
  CREATE TABLE position_history (
    id UUID PRIMARY KEY,
    device_id VARCHAR(100),
    timestamp TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(8, 2),
    speed DECIMAL(6, 2),
    azimuth DECIMAL(5, 1),
    flight_mode VARCHAR(50),
    battery_level INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] API 함수 생성 요청
  ```sql
  CREATE FUNCTION ah_save_position_history(
    p_positions JSONB[]
  ) RETURNS JSONB
  ```

### Phase 5: 모니터링 및 관리
- [ ] 전송 상태 대시보드 생성
  - 파일명: `/public/position-monitor.html`
  - 기능: 전송 상태, 실패 건수, 큐 상태 표시
- [ ] 전송 로그 기록
  ```javascript
  class PositionLogger {
    logSuccess(count) { }
    logFailure(error) { }
    getStats() { }
  }
  ```
- [ ] 중복 전송 방지 로직
  ```javascript
  function generatePositionHash(position) {
    return `${position.device_id}_${position.timestamp}`;
  }
  ```

### Phase 6: 데이터 정리 및 최적화
- [ ] localStorage 용량 관리
  - 전송 완료된 데이터 삭제
  - 최대 보관 기간 설정 (예: 7일)
- [ ] 로그 파일 아카이빙
  - 전송 완료된 로그 파일 압축
  - 오래된 파일 자동 삭제

## 🔧 구현 세부사항

### 1. Position API Client 구조
```javascript
class PositionAPIClient {
  constructor(config) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.queue = [];
    this.sending = false;
  }

  async sendPosition(position) {
    // 단일 위치 전송
  }

  async sendBatch(positions) {
    // 배치 전송
  }

  async processQueue() {
    // 큐 처리
  }

  async migrateFromLocalStorage() {
    // localStorage 마이그레이션
  }

  async migrateFromLogs(logPath) {
    // 로그 파일 마이그레이션
  }
}
```

### 2. 실시간 전송 플로우
```
1. 드론 위치 업데이트 수신
   ↓
2. 위치 데이터 검증
   ↓
3. API 전송 시도
   ↓
4. 성공: 다음 위치 대기
   실패: 큐에 저장 → 재시도
```

### 3. 배치 전송 전략
- **전송 간격**: 5초마다
- **배치 크기**: 최대 100개
- **재시도**: 3회 (지수 백오프)
- **실패 처리**: localStorage 백업

## 📝 테스트 계획

### 1. 단위 테스트
- [ ] API 연결 테스트
- [ ] 데이터 변환 테스트
- [ ] 큐 관리 테스트
- [ ] 재시도 로직 테스트

### 2. 통합 테스트
- [ ] 실시간 전송 테스트
- [ ] 배치 전송 테스트
- [ ] 마이그레이션 테스트
- [ ] 오류 복구 테스트

### 3. 성능 테스트
- [ ] 대용량 데이터 전송 (10,000건)
- [ ] 네트워크 끊김 시나리오
- [ ] API 응답 지연 시나리오

## 🚨 주의사항

1. **데이터 무결성**
   - 전송 전 백업 필수
   - 중복 전송 방지
   - 데이터 유실 방지

2. **API 제한**
   - Rate limiting 고려
   - 요청 크기 제한 확인
   - 타임아웃 설정

3. **보안**
   - API 키 안전 관리
   - HTTPS 사용
   - 민감 정보 암호화

## 📅 예상 일정
- Phase 1-2: 1일 (API 클라이언트 및 마이그레이션 도구)
- Phase 3: 1일 (실시간 전송 시스템)
- Phase 4: 0.5일 (API 스키마 조정)
- Phase 5-6: 1일 (모니터링 및 최적화)
- 테스트: 0.5일

**총 예상 소요 시간**: 4일

## 🔄 롤백 계획
1. 기존 localStorage 백업 유지
2. API 전송 ON/OFF 플래그
3. 로그 파일 백업 보관
4. 이전 버전 코드 태깅

## 📞 문의사항
- API 스키마 변경 필요 시 고객사 연락
- 새로운 엔드포인트 추가 요청
- Rate limiting 정책 확인

---

**작성일**: 2025-09-13  
**작성자**: Claude Code  
**버전**: 1.0