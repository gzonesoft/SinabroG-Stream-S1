# 📍 AH 위치 이력 조회 API 가이드

## 1. 위치 이력 조회 - ah_get_position_history

### 📋 파라미터
- `p_device_id` (필수): 조회할 디바이스 ID
- `p_start_date` (선택): 시작 날짜 (기본: 24시간 전)
- `p_end_date` (선택): 종료 날짜 (기본: 현재)
- `p_limit` (선택): 조회 건수 제한 (기본: 1000)

### 🔧 cURL 호출 예시

#### 1) 최근 24시간 이력 조회 (기본값)
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_position_history" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DJI_DEVICE_001"
  }'
```

#### 2) 특정 기간 이력 조회
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_position_history" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DJI_DEVICE_001",
    "p_start_date": "2025-09-13T00:00:00+09:00",
    "p_end_date": "2025-09-13T23:59:59+09:00",
    "p_limit": 100
  }'
```

#### 3) Docker를 통한 직접 DB 조회
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT * FROM ah_get_position_history(
    'DJI_DEVICE_001',
    '2025-09-13 00:00:00'::timestamptz,
    '2025-09-13 23:59:59'::timestamptz,
    100
);
"
```

### 📊 응답 예시
```json
[
  {
    "id": 7,
    "device_id": "DJI_DEVICE_001",
    "position_timestamp": "2025-09-13T02:20:08.108+00:00",
    "latitude": 36.58687633044327,
    "longitude": 127.24105084721177,
    "altitude": -0.6,
    "speed": 0.1,
    "heading": 31.2,
    "battery_level": 55,
    "distance_from_previous": 0.0
  },
  {
    "id": 6,
    "device_id": "DJI_DEVICE_001",
    "position_timestamp": "2025-09-13T02:15:08.108+00:00",
    "latitude": 36.58687633044327,
    "longitude": 127.24105084721177,
    "altitude": -0.5,
    "speed": 0.2,
    "heading": 30.0,
    "battery_level": 56,
    "distance_from_previous": 141.89
  }
]
```

## 2. 현재 위치 조회 - ah_get_current_position

### 🔧 cURL 호출 예시

#### 1) 특정 디바이스의 현재 위치
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_current_position" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DJI_DEVICE_001"
  }'
```

#### 2) 모든 활성 디바이스의 현재 위치
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_current_position" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 3) Docker를 통한 직접 조회
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT * FROM ah_get_current_position('DJI_DEVICE_001');
"
```

### 📊 응답 예시
```json
[
  {
    "device_id": "DJI_DEVICE_001",
    "device_name": "DJI Mavic 3",
    "position_timestamp": "2025-09-13T02:20:08.108+00:00",
    "latitude": 36.58687633044327,
    "longitude": 127.24105084721177,
    "altitude": -0.6,
    "speed": 0.1,
    "heading": 31.2,
    "battery_level": 55,
    "last_updated": "2025-09-13T02:20:08.108+00:00"
  }
]
```

## 3. 지역 내 디바이스 검색 - ah_get_devices_in_area

### 🔧 cURL 호출 예시

#### 1km 반경 내 디바이스 검색
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_devices_in_area" \
  -H "Content-Type: application/json" \
  -d '{
    "p_center_lat": 37.5665,
    "p_center_lon": 126.9780,
    "p_radius_meters": 1000
  }'
```

#### Docker를 통한 직접 조회
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT * FROM ah_get_devices_in_area(37.5665, 126.9780, 1000);
"
```

### 📊 응답 예시
```json
[
  {
    "device_id": "DJI_DEVICE_001",
    "device_name": "DJI Mavic 3",
    "latitude": 37.5665,
    "longitude": 126.9780,
    "distance_meters": 0.0,
    "battery_level": 55,
    "last_updated": "2025-09-13T02:20:08.108+00:00"
  },
  {
    "device_id": "DJI_DEVICE_002",
    "device_name": "DJI Mini 3",
    "latitude": 37.5670,
    "longitude": 126.9785,
    "distance_meters": 70.94,
    "battery_level": 88,
    "last_updated": "2025-09-13T02:19:00.000+00:00"
  }
]
```

## 4. 위치 통계 조회 - ah_get_position_stats

### 🔧 cURL 호출 예시

#### 7일간 통계 조회 (기본값)
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_position_stats" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DJI_DEVICE_001"
  }'
```

#### 30일간 통계 조회
```bash
curl -X POST "http://localhost:17321/rest/v1/rpc/ah_get_position_stats" \
  -H "Content-Type: application/json" \
  -d '{
    "p_device_id": "DJI_DEVICE_001",
    "p_period_days": 30
  }'
```

#### Docker를 통한 직접 조회
```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT ah_get_position_stats('DJI_DEVICE_001', 7);
"
```

### 📊 응답 예시
```json
{
  "device_id": "DJI_DEVICE_001",
  "period_days": 7,
  "total_positions": 1440,
  "total_distance_meters": 15234.56,
  "total_distance_km": 15.23,
  "average_speed_ms": 5.67,
  "max_altitude_meters": 120.50,
  "min_battery_level": 15,
  "positions_per_day": 205.71
}
```

## 5. JavaScript/Python 예시

### JavaScript (Fetch API)
```javascript
// 위치 이력 조회
async function getPositionHistory(deviceId, startDate, endDate) {
    const response = await fetch("http://localhost:17321/rest/v1/rpc/ah_get_position_history", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_device_id: deviceId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_limit: 1000
        })
    });
    
    return await response.json();
}

// 사용 예시
const history = await getPositionHistory(
    "DJI_DEVICE_001",
    "2025-09-13T00:00:00+09:00",
    "2025-09-13T23:59:59+09:00"
);
console.log(history);
```

### Python (requests)
```python
import requests
import json
from datetime import datetime, timedelta

def get_position_history(device_id, start_date=None, end_date=None, limit=1000):
    """디바이스 위치 이력 조회"""
    
    url = "http://localhost:17321/rest/v1/rpc/ah_get_position_history"
    
    # 기본값: 최근 24시간
    if not start_date:
        start_date = (datetime.now() - timedelta(days=1)).isoformat()
    if not end_date:
        end_date = datetime.now().isoformat()
    
    payload = {
        "p_device_id": device_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_limit": limit
    }
    
    response = requests.post(url, json=payload)
    return response.json()

def get_current_position(device_id=None):
    """현재 위치 조회"""
    
    url = "http://localhost:17321/rest/v1/rpc/ah_get_current_position"
    payload = {}
    
    if device_id:
        payload["p_device_id"] = device_id
    
    response = requests.post(url, json=payload)
    return response.json()

def get_devices_in_area(center_lat, center_lon, radius_meters=1000):
    """지역 내 디바이스 검색"""
    
    url = "http://localhost:17321/rest/v1/rpc/ah_get_devices_in_area"
    
    payload = {
        "p_center_lat": center_lat,
        "p_center_lon": center_lon,
        "p_radius_meters": radius_meters
    }
    
    response = requests.post(url, json=payload)
    return response.json()

# 사용 예시
if __name__ == "__main__":
    # 위치 이력 조회
    history = get_position_history("DJI_DEVICE_001")
    print(f"위치 이력: {len(history)}건")
    
    # 현재 위치 조회
    current = get_current_position("DJI_DEVICE_001")
    print(f"현재 위치: {current}")
    
    # 1km 반경 내 디바이스
    nearby = get_devices_in_area(37.5665, 126.9780, 1000)
    print(f"주변 디바이스: {len(nearby)}대")
```

## 6. 실시간 모니터링 예시

### Bash 스크립트로 실시간 모니터링
```bash
#!/bin/bash

# 5초마다 현재 위치 확인
while true; do
    clear
    echo "=== DJI 드론 실시간 위치 모니터링 ==="
    echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    docker exec -i supabase-db psql -U postgres -d postgres -t -c "
    SELECT json_build_object(
        'device_id', device_id,
        'lat', latitude,
        'lon', longitude,
        'alt', altitude,
        'battery', battery_level,
        'updated', last_updated
    ) 
    FROM now_position 
    WHERE device_id = 'DJI_DEVICE_001';
    "
    
    sleep 5
done
```

## 7. 데이터 내보내기 예시

### CSV 형식으로 내보내기
```bash
# 위치 이력을 CSV로 내보내기
docker exec -i supabase-db psql -U postgres -d postgres -c "
COPY (
    SELECT * FROM ah_get_position_history(
        'DJI_DEVICE_001',
        '2025-09-13 00:00:00'::timestamptz,
        '2025-09-13 23:59:59'::timestamptz,
        10000
    )
) TO STDOUT WITH CSV HEADER;
" > position_history_$(date +%Y%m%d).csv

echo "데이터를 position_history_$(date +%Y%m%d).csv 파일로 내보냈습니다."
```

## 8. 문제 해결

### ❌ 인증 오류 발생 시
현재 REST API 인증 문제가 있으므로 Docker를 통한 직접 DB 접근을 사용하세요:
```bash
docker exec -i supabase-db psql -U postgres -d postgres
```

### ❌ 데이터가 조회되지 않을 때
```bash
# 디바이스 목록 확인
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT device_id, device_name, is_active, last_seen 
FROM device_mng 
ORDER BY last_seen DESC;
"

# 저장된 이력 건수 확인
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT device_id, COUNT(*) as count 
FROM position_history 
GROUP BY device_id;
"
```

## 9. 성능 최적화 팁

### 대량 데이터 조회 시
- `p_limit` 파라미터로 조회 건수 제한
- 시간 범위를 좁혀서 조회
- 필요한 컬럼만 선택하여 조회

### 실시간 추적
- 현재 위치만 필요한 경우 `ah_get_current_position` 사용
- 폴링 간격은 최소 5초 이상 권장

## 📞 지원
- 📧 기술지원: support@gzonesoft.com
- 📱 긴급연락: 010-1234-5678
- 💬 슬랙: #ah-api-support

---
**작성일**: 2025-09-13  
**버전**: 1.0.0  
**작성자**: GZoneSoft 개발팀