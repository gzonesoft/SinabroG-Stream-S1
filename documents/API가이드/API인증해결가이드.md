# 🔐 AH API 인증 오류 해결 가이드

## 문제 상황
```json
{
  "message": "Invalid authentication credentials"
}
```

## ✅ 해결 방법

### 1. 올바른 API 키 사용

**⚠️ 현재 인증 문제 상황**

현재 Supabase JWT 인증 시스템에 설정 불일치 문제가 있어 API 호출이 거부되고 있습니다.

**임시 해결책**:

1. **올바른 JWT 토큰** (2025년 유효):
   - ANON_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NzM2NzgwLCJleHAiOjE3ODkyNzI3ODB9.ysKG7uo3HrMGeO8evJAs-ce01Jp-xxZ0CWa6ZQTcdVY`
   - SERVICE_ROLE_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTc3MzY3ODAsImV4cCI6MTc4OTI3Mjc4MH0.trdg3lZkYdrIza__zA7lge3TdY-viQt3Z1cUWLbbP_w`

2. **PostgreSQL 직접 접근** (우회 방법):
   ```bash
   # Docker를 통한 직접 DB 접근으로 함수 테스트
   docker exec -i supabase-db psql -U postgres -d postgres -c "
   SELECT ah_save_position_history('customer_test', 37.5665, 126.9780, 100.0, 15.5, 180.0, 85, NOW());
   "
   ```

### 2. 올바른 Header 설정

**필수 Headers** (현재 인증 문제로 작동하지 않음):
```javascript
{
  "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NzM2NzgwLCJleHAiOjE3ODkyNzI3ODB9.ysKG7uo3HrMGeO8evJAs-ce01Jp-xxZ0CWa6ZQTcdVY",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NzM2NzgwLCJleHAiOjE3ODkyNzI3ODB9.ysKG7uo3HrMGeO8evJAs-ce01Jp-xxZ0CWa6ZQTcdVY",
  "Content-Type": "application/json"
}
```

## 🔧 올바른 API 호출 예시

### cURL 명령어
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_save_position_history" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "ah001",
    "p_latitude": 37.5665,
    "p_longitude": 126.9780,
    "p_altitude": 100.0,
    "p_speed": 15.5,
    "p_heading": 180.0,
    "p_battery_level": 85
  }'
```

### JavaScript (Fetch API)
```javascript
const response = await fetch("http://localhost:17321/rest/v1/rpc/ah_save_position_history", {
    method: "POST",
    headers: {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        p_device_id: "ah001",
        p_latitude: 37.5665,
        p_longitude: 126.9780,
        p_altitude: 100.0,
        p_speed: 15.5,
        p_heading: 180.0,
        p_battery_level: 85
    })
});

const data = await response.json();
console.log(data);
```

### Python (requests)
```python
import requests
import json

url = "http://localhost:17321/rest/v1/rpc/ah_save_position_history"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
    "Content-Type": "application/json"
}

data = {
    "p_device_id": "ah001",
    "p_latitude": 37.5665,
    "p_longitude": 126.9780,
    "p_altitude": 100.0,
    "p_speed": 15.5,
    "p_heading": 180.0,
    "p_battery_level": 85
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## 📋 매개변수 설명

### 필수 매개변수
- `p_device_id` (VARCHAR): 드론 디바이스 ID
- `p_latitude` (DOUBLE): 위도
- `p_longitude` (DOUBLE): 경도

### 선택 매개변수
- `p_altitude` (DOUBLE): 고도 (기본값: 0)
- `p_speed` (DOUBLE): 속도 (기본값: 0)
- `p_heading` (DOUBLE): 방향각 (기본값: 0)
- `p_battery_level` (INTEGER): 배터리 레벨 (기본값: NULL)
- `p_timestamp` (TIMESTAMPTZ): 시간 (기본값: NOW())
- `p_metadata` (JSONB): 메타데이터 (기본값: NULL)

## 🎯 성공 응답 예시
```json
{
  "success": true,
  "device_id": "ah001",
  "position_id": 1,
  "message": "위치 이력이 성공적으로 저장되었습니다.",
  "location": {
    "lat": 37.5665,
    "lon": 126.978,
    "alt": 100,
    "speed": 15.5,
    "heading": 180,
    "distance_from_last_m": 0.00
  },
  "timestamp": "2025-09-13T03:28:06.114718+00:00",
  "auto_stats": {
    "device_id": "ah001",
    "period_days": 7,
    "total_positions": 1,
    "total_distance_meters": 0.00,
    "average_speed_ms": 15.50,
    "max_altitude_meters": 100.00,
    "min_battery_level": 85,
    "positions_per_day": 0.14
  },
  "nearby_devices": []
}
```

## ❌ 자주 발생하는 오류

### 1. Header 누락
```json
{ "message": "Invalid authentication credentials" }
```
**해결**: `apikey`와 `Authorization` 헤더 모두 포함

### 2. 잘못된 Content-Type
```json
{ "message": "Bad Request" }
```
**해결**: `Content-Type: application/json` 헤더 추가

### 3. 잘못된 API 키
```json
{ "message": "JWT expired" }
```
**해결**: 위에 제공된 올바른 ANON_KEY 사용

## 🛠️ 디버깅 도구

### Swagger UI 테스트
브라우저에서 직접 테스트:
```bash
# 로컬 서버 실행
cd /Users/gzonesoft/supabase/public
python3 -m http.server 8080

# 브라우저에서 접속
http://localhost:8080/swagger-ui.html
```

### API 상태 확인
```bash
curl -X GET "http://localhost:17321/rest/v1/" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 📞 지원
- 📧 기술지원: support@gzonesoft.com
- 📱 긴급연락: 010-1234-5678
- 💬 슬랙: #ah-api-support

---
**업데이트**: 2025-09-13  
**작성자**: GZoneSoft 개발팀