# 📝 AH 위치 저장 API - 예비 컬럼 사용 가이드

## 1. 예비 컬럼 개요

위치 데이터와 함께 **사용자 정의 데이터**를 저장할 수 있는 예비 컬럼이 추가되었습니다.

### 📋 사용 가능한 예비 컬럼

| 컬럼명 | 타입 | 설명 | 최대 크기 |
|--------|------|------|-----------|
| spare_text1~5 | TEXT | 텍스트 데이터 (미션ID, 파일럿명, 목적 등) | 무제한 |
| spare_numeric1~3 | DOUBLE | 숫자 데이터 (추가 센서값, 계산값 등) | - |
| spare_json | JSONB | 구조화된 JSON 데이터 | 무제한 |
| custom_data | TEXT | 대용량 커스텀 데이터 | 1GB |

## 2. API 호출 예시

### 2.1 모든 예비 컬럼 사용

```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_save_position_history" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DRONE_001",
    "p_latitude": 37.5665,
    "p_longitude": 126.9780,
    "p_altitude": 100.0,
    "p_speed": 15.5,
    "p_heading": 180.0,
    "p_battery_level": 85,
    "p_timestamp": "2025-09-13T15:00:00+09:00",
    "p_metadata": {
      "flight_mode": "GPS_NORMAL",
      "satellite_count": 17
    },
    "p_spare_text1": "MISSION_ID_12345",
    "p_spare_text2": "PILOT_NAME_JOHN",
    "p_spare_text3": "FLIGHT_PURPOSE_DELIVERY",
    "p_spare_text4": "WEATHER_CLEAR",
    "p_spare_text5": "NOTE_EMERGENCY_LANDING_AVAILABLE",
    "p_spare_numeric1": 123.456,
    "p_spare_numeric2": 789.012,
    "p_spare_numeric3": 345.678,
    "p_spare_json": {
      "mission": {
        "type": "delivery",
        "priority": "high",
        "items": ["package1", "package2"],
        "destination": {
          "address": "서울시 강남구",
          "contact": "010-1234-5678"
        }
      }
    },
    "p_custom_data": "Large custom data content here..."
  }'
```

### 2.2 일부 예비 컬럼만 사용

```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_save_position_history" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DRONE_002",
    "p_latitude": 37.5665,
    "p_longitude": 126.9780,
    "p_spare_text1": "MISSION_67890",
    "p_spare_json": {
      "inspection": {
        "target": "power_line",
        "status": "in_progress"
      }
    }
  }'
```

### 2.3 예비 컬럼 없이 사용 (하위 호환성)

```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_save_position_history" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DRONE_003",
    "p_latitude": 37.5665,
    "p_longitude": 126.9780,
    "p_altitude": 100.0,
    "p_speed": 15.5,
    "p_heading": 180.0,
    "p_battery_level": 85
  }'
```

## 3. Docker 직접 호출

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT ah_save_position_history(
    'DRONE_001',                          -- device_id
    37.5665, 126.9780,                    -- lat, lon
    100.0, 15.5, 180.0,                   -- alt, speed, heading
    85,                                    -- battery
    '2025-09-13T15:00:00+09:00',         -- timestamp
    '{\"test\": \"data\"}'::jsonb,        -- metadata
    'MISSION_12345',                      -- spare_text1
    'PILOT_JOHN',                         -- spare_text2
    'DELIVERY',                           -- spare_text3
    'CLEAR',                              -- spare_text4
    'NOTE',                               -- spare_text5
    123.456,                              -- spare_numeric1
    789.012,                              -- spare_numeric2
    345.678,                              -- spare_numeric3
    '{\"mission\": \"data\"}'::jsonb,     -- spare_json
    'Custom large data...'                -- custom_data
);
"
```

## 4. 배치 저장 예시

```javascript
// JavaScript 예시
const positions = [
  {
    device_id: "DRONE_001",
    latitude: 37.5665,
    longitude: 126.9780,
    spare_text1: "BATCH_001",
    spare_json: { batch: true, index: 1 }
  },
  {
    device_id: "DRONE_002",
    latitude: 37.5670,
    longitude: 126.9785,
    spare_text1: "BATCH_002",
    spare_numeric1: 999.999
  }
];

const response = await fetch("http://localhost:17321/rest/v1/rpc/ah_batch_save_positions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ p_positions: positions })
});
```

## 5. 예비 컬럼 조회

### 5.1 예비 컬럼 포함하여 조회

```bash
# 예비 컬럼 포함 (p_include_spare = TRUE)
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT * FROM ah_get_position_history(
    'DRONE_001',
    '2025-09-13 00:00:00'::timestamptz,
    NOW(),
    100,
    TRUE  -- 예비 컬럼 포함
);
"
```

### 5.2 예비 컬럼 제외하고 조회 (기본값)

```bash
# 예비 컬럼 제외 (p_include_spare = FALSE 또는 생략)
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT * FROM ah_get_position_history(
    'DRONE_001',
    '2025-09-13 00:00:00'::timestamptz,
    NOW(),
    100
);
"
```

## 6. 활용 사례

### 6.1 배송 드론
```json
{
  "spare_text1": "ORDER_ID_12345",
  "spare_text2": "CUSTOMER_NAME",
  "spare_text3": "DELIVERY_ADDRESS",
  "spare_json": {
    "package": {
      "weight": 2.5,
      "fragile": true,
      "contents": "electronics"
    }
  }
}
```

### 6.2 농업 드론
```json
{
  "spare_text1": "FIELD_ID_A1",
  "spare_text2": "CROP_TYPE_RICE",
  "spare_numeric1": 15.5,  // 살포량
  "spare_numeric2": 85.3,  // 작업 진행률
  "spare_json": {
    "pesticide": {
      "type": "organic",
      "amount_liters": 15.5
    }
  }
}
```

### 6.3 검사/점검 드론
```json
{
  "spare_text1": "INSPECTION_ID_2025",
  "spare_text2": "BRIDGE_SECTION_B",
  "spare_json": {
    "defects": [
      {
        "type": "crack",
        "severity": "medium",
        "location": "pier_3"
      }
    ]
  },
  "custom_data": "상세 점검 보고서 내용..."
}
```

## 7. 응답 예시

### 성공 응답
```json
{
  "success": true,
  "device_id": "DRONE_001",
  "position_id": 123,
  "message": "위치 이력이 성공적으로 저장되었습니다.",
  "spare_fields_saved": {
    "text_fields": [true, true, true, false, false],
    "numeric_fields": [true, false, false],
    "json_field": true,
    "custom_data": true
  }
}
```

## 8. Python 예시

```python
import requests
import json

def save_position_with_spare(device_id, lat, lon, **kwargs):
    """예비 컬럼을 포함한 위치 저장"""
    
    url = "http://localhost:17321/rest/v1/rpc/ah_save_position_history"
    
    # 기본 위치 데이터
    payload = {
        "p_device_id": device_id,
        "p_latitude": lat,
        "p_longitude": lon
    }
    
    # 선택적 예비 컬럼 추가
    spare_fields = [
        'p_spare_text1', 'p_spare_text2', 'p_spare_text3',
        'p_spare_text4', 'p_spare_text5', 'p_spare_numeric1',
        'p_spare_numeric2', 'p_spare_numeric3', 'p_spare_json',
        'p_custom_data'
    ]
    
    for field in spare_fields:
        if field[2:] in kwargs:  # p_ 제거
            payload[field] = kwargs[field[2:]]
    
    response = requests.post(url, json=payload)
    return response.json()

# 사용 예시
result = save_position_with_spare(
    "DRONE_001",
    37.5665,
    126.9780,
    spare_text1="MISSION_123",
    spare_text2="PILOT_KIM",
    spare_json={"mission": "delivery"},
    custom_data="Large content here..."
)
print(result)
```

## 9. 주의사항

### ⚠️ 성능 고려사항
- `custom_data`는 최대 1GB까지 저장 가능하나, 대용량 데이터는 성능에 영향
- 자주 검색하는 데이터는 `spare_text1~5` 사용 (인덱스 지원)
- 구조화된 데이터는 `spare_json` 사용 (GIN 인덱스 지원)

### ⚠️ 하위 호환성
- 예비 컬럼은 모두 **선택적(Optional)**
- 기존 API 호출은 그대로 동작
- 예비 컬럼 없이 호출 시 NULL로 저장

### ⚠️ 데이터 검증
- 예비 컬럼의 데이터 타입 확인 필요
- `spare_numeric` 필드는 숫자만 가능
- `spare_json` 필드는 유효한 JSON 형식이어야 함

## 10. 문제 해결

### 예비 컬럼이 저장되지 않을 때
```bash
# 테이블 구조 확인
docker exec -i supabase-db psql -U postgres -d postgres -c "
\d position_history
"

# 저장된 데이터 확인
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT device_id, spare_text1, spare_json 
FROM position_history 
WHERE device_id = 'YOUR_DEVICE_ID'
ORDER BY created_at DESC
LIMIT 5;
"
```

## 📞 지원
- 📧 기술지원: support@gzonesoft.com
- 📱 긴급연락: 010-1234-5678
- 💬 슬랙: #ah-api-support

---
**작성일**: 2025-09-13  
**버전**: 2.0.0  
**작성자**: GZoneSoft 개발팀