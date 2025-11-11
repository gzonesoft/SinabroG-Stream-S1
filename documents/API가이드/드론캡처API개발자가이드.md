# 📸 AH 드론 캡처 API 개발자 가이드

## 1. 개요

### 1.1 서비스 소개
AH 드론 캡처 API는 드론 스트리밍 영상의 캡처 이미지를 저장하고 관리하는 클라우드 기반 서비스입니다. 기존 브라우저의 localStorage 한계를 극복하고 중앙 집중식 데이터 관리를 제공합니다.

### 1.2 주요 기능
- ✅ 스트림 캡처 이미지 저장 및 관리
- ✅ 드론 위치 정보와 함께 저장
- ✅ 태그 기반 검색 및 필터링
- ✅ 배치 업로드 지원
- ✅ 통계 및 분석 제공

### 1.3 API 엔드포인트
```
기본 URL: http://localhost:17321
프로덕션 URL: https://your-project.supabase.co
```

## 2. 인증 설정

### 2.1 API 키 발급
```javascript
// Supabase 대시보드에서 발급받은 키 사용
const SUPABASE_URL = "http://localhost:17321";
const SUPABASE_ANON_KEY = "your-anon-key-here";
```

### 2.2 헤더 설정
모든 API 요청에 다음 헤더를 포함해야 합니다:
```javascript
const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};
```

## 3. API 함수 목록

### 3.1 캡처 생성 - `ah_create_capture`

#### 요청
```javascript
// 단일 캡처 생성
const createCapture = async (captureData) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_create_capture`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_capture_id: Date.now().toString(),  // 고유 ID
            p_device_id: 'DJI_DEVICE_001',       // 디바이스 ID
            p_timestamp: new Date().toISOString(),
            p_stream_key: 'stream_001',
            p_title: '한강 드론 촬영',
            p_image_data: 'data:image/jpeg;base64,...',  // Base64 이미지
            p_drone_data: {
                lat: 37.5665,
                lng: 126.9780,
                alt: 50.5,
                heading: 270
            },
            p_metadata: {
                fileSize: 245760,
                mimeType: 'image/jpeg',
                width: 1920,
                height: 1080
            },
            p_tags: ['한강', '드론', '야경'],
            p_description: '한강 야경 드론 촬영'
        })
    });
    
    return await response.json();
};
```

#### 응답
```json
{
    "success": true,
    "capture_id": "1757644800000",
    "message": "캡처가 성공적으로 저장되었습니다.",
    "timestamp": "2025-09-13T05:00:00Z"
}
```

### 3.2 캡처 목록 조회 - `ah_get_captures`

#### 요청
```javascript
// 캡처 목록 조회
const getCaptures = async (filters = {}) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_get_captures`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_device_id: filters.deviceId || null,
            p_stream_key: filters.streamKey || null,
            p_start_date: filters.startDate || null,
            p_end_date: filters.endDate || null,
            p_limit: filters.limit || 100,
            p_offset: filters.offset || 0,
            p_tags: filters.tags || null
        })
    });
    
    return await response.json();
};

// 사용 예시
const captures = await getCaptures({
    streamKey: 'stream_001',
    limit: 20,
    tags: ['드론', '한강']
});
```

#### 응답
```json
[
    {
        "capture_id": "1757644800000",
        "device_id": "DJI_DEVICE_001",
        "device_name": "DJI Mavic 3",
        "timestamp": "2025-09-13T05:00:00Z",
        "stream_key": "stream_001",
        "title": "한강 드론 촬영",
        "image_url": "/uploads/captures/1757644800000.jpg",
        "thumbnail_url": "/uploads/thumbs/1757644800000.jpg",
        "drone_lat": 37.5665,
        "drone_lng": 126.9780,
        "drone_alt": 50.5,
        "drone_heading": 270,
        "tags": ["한강", "드론", "야경"],
        "description": "한강 야경 드론 촬영",
        "is_public": false,
        "view_count": 0,
        "created_at": "2025-09-13T05:00:00Z"
    }
]
```

### 3.3 특정 캡처 조회 - `ah_get_capture_by_id`

#### 요청
```javascript
const getCaptureById = async (captureId) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_get_capture_by_id`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_capture_id: captureId
        })
    });
    
    return await response.json();
};
```

### 3.4 캡처 업데이트 - `ah_update_capture`

#### 요청
```javascript
const updateCapture = async (captureId, updates) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_update_capture`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_capture_id: captureId,
            p_title: updates.title,
            p_description: updates.description,
            p_tags: updates.tags,
            p_is_public: updates.isPublic
        })
    });
    
    return await response.json();
};
```

### 3.5 캡처 삭제 - `ah_delete_capture`

#### 요청
```javascript
const deleteCapture = async (captureId) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_delete_capture`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_capture_id: captureId
        })
    });
    
    return await response.json();
};
```

### 3.6 배치 캡처 생성 - `ah_batch_create_captures`

#### 요청
```javascript
const batchCreateCaptures = async (capturesList) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_batch_create_captures`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_captures: capturesList.map(capture => ({
                id: capture.id || Date.now().toString(),
                deviceId: capture.deviceId,
                timestamp: capture.timestamp,
                streamKey: capture.streamKey,
                title: capture.title,
                imageData: capture.imageData,
                droneData: capture.droneData,
                tags: capture.tags,
                description: capture.description
            }))
        })
    });
    
    return await response.json();
};

// 사용 예시
const result = await batchCreateCaptures([
    {
        deviceId: 'DJI_001',
        timestamp: new Date().toISOString(),
        streamKey: 'stream_001',
        title: '캡처 1',
        imageData: 'data:image/jpeg;base64,...'
    },
    {
        deviceId: 'DJI_001',
        timestamp: new Date().toISOString(),
        streamKey: 'stream_001',
        title: '캡처 2',
        imageData: 'data:image/jpeg;base64,...'
    }
]);
```

### 3.7 캡처 검색 - `ah_search_captures`

#### 요청
```javascript
const searchCaptures = async (searchParams) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_search_captures`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_search_term: searchParams.query || null,
            p_tags: searchParams.tags || null,
            p_start_date: searchParams.startDate || null,
            p_end_date: searchParams.endDate || null,
            p_is_public: searchParams.isPublic || null,
            p_limit: searchParams.limit || 50,
            p_offset: searchParams.offset || 0
        })
    });
    
    return await response.json();
};

// 사용 예시
const results = await searchCaptures({
    query: '한강',
    tags: ['드론', '야경'],
    limit: 20
});
```

### 3.8 캡처 통계 - `ah_get_capture_stats`

#### 요청
```javascript
const getCaptureStats = async (deviceId = null, streamKey = null) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_get_capture_stats`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            p_device_id: deviceId,
            p_stream_key: streamKey,
            p_period_days: 30
        })
    });
    
    return await response.json();
};
```

#### 응답
```json
{
    "total_captures": 150,
    "total_views": 3420,
    "total_size_bytes": 157286400,
    "total_size_mb": 150.00,
    "recent_captures": 45,
    "period_days": 30,
    "popular_tags": ["드론", "한강", "야경", "일출"],
    "average_views": 22.80
}
```

## 4. localStorage 마이그레이션

### 4.1 기존 데이터 읽기
```javascript
// localStorage에서 기존 캡처 데이터 읽기
const migrateFromLocalStorage = async () => {
    const localCaptures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
    
    if (localCaptures.length > 0) {
        console.log(`${localCaptures.length}개의 캡처를 마이그레이션합니다...`);
        
        // 배치로 업로드
        const result = await batchCreateCaptures(localCaptures);
        
        if (result.success) {
            console.log(`성공: ${result.success_count}개, 실패: ${result.error_count}개`);
            
            // 성공 시 localStorage 클리어
            if (result.error_count === 0) {
                localStorage.removeItem('streamCaptures');
                console.log('localStorage 데이터 삭제 완료');
            }
        }
    }
};
```

### 4.2 호환성 래퍼 클래스
```javascript
class CaptureStorageAdapter {
    constructor(useAPI = true) {
        this.useAPI = useAPI;
        this.baseURL = SUPABASE_URL;
        this.headers = headers;
    }
    
    // localStorage 형식과 호환되는 메소드
    async getCaptures(streamKey = null) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_get_captures`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_stream_key: streamKey,
                        p_limit: 1000
                    })
                });
                
                if (!response.ok) throw new Error('API 오류');
                
                const data = await response.json();
                
                // localStorage 형식으로 변환
                return data.map(item => ({
                    id: item.capture_id,
                    timestamp: new Date(item.timestamp).getTime(),
                    imageData: item.image_url, // URL로 대체
                    streamKey: item.stream_key,
                    title: item.title,
                    droneData: {
                        lat: item.drone_lat,
                        lng: item.drone_lng,
                        alt: item.drone_alt,
                        heading: item.drone_heading
                    }
                }));
            } catch (error) {
                console.error('API 오류, localStorage 폴백:', error);
                this.useAPI = false;
            }
        }
        
        // localStorage 폴백
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        if (streamKey) {
            captures = captures.filter(c => c.streamKey === streamKey);
        }
        return captures;
    }
    
    async saveCapture(capture) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_create_capture`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_capture_id: capture.id || Date.now().toString(),
                        p_device_id: capture.deviceId || 'unknown',
                        p_timestamp: new Date(capture.timestamp).toISOString(),
                        p_stream_key: capture.streamKey,
                        p_title: capture.title,
                        p_image_data: capture.imageData,
                        p_drone_data: capture.droneData
                    })
                });
                
                if (!response.ok) throw new Error('API 저장 실패');
                
                return await response.json();
            } catch (error) {
                console.error('API 저장 실패, localStorage 폴백:', error);
                this.useAPI = false;
            }
        }
        
        // localStorage 폴백
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        captures.push(capture);
        localStorage.setItem('streamCaptures', JSON.stringify(captures));
        return { success: true, capture_id: capture.id };
    }
    
    async deleteCapture(captureId) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_delete_capture`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_capture_id: captureId
                    })
                });
                
                if (!response.ok) throw new Error('API 삭제 실패');
                
                return await response.json();
            } catch (error) {
                console.error('API 삭제 실패, localStorage 폴백:', error);
                this.useAPI = false;
            }
        }
        
        // localStorage 폴백
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        captures = captures.filter(c => c.id !== captureId);
        localStorage.setItem('streamCaptures', JSON.stringify(captures));
        return { success: true };
    }
}

// 전역 인스턴스 생성
window.captureStorage = new CaptureStorageAdapter(true);
```

## 5. 실제 구현 예제

### 5.1 camera.html 수정
```javascript
// 기존 코드
// this.captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');

// 새 코드
this.captures = await window.captureStorage.getCaptures(this.currentStreamKey);
```

### 5.2 viewer.js 수정
```javascript
// 기존 코드
// localStorage.setItem('streamCaptures', JSON.stringify(captures));

// 새 코드
await window.captureStorage.saveCapture(newCapture);
```

### 5.3 완전한 예제 - 캡처 매니저
```javascript
class DroneCaptureMana`${SUPABASE_URL}/rest/v1/rpc/ah_delete_all_captures`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    p_device_id: deviceId,
                    p_stream_key: streamKey
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('전체 삭제 실패:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 캡처 뷰 렌더링
    renderCaptures(captures) {
        const container = document.getElementById('capture-container');
        container.innerHTML = '';
        
        captures.forEach(capture => {
            const card = document.createElement('div');
            card.className = 'capture-card';
            card.innerHTML = `
                <img src="${capture.image_url || capture.thumbnail_url}" alt="${capture.title}">
                <div class="capture-info">
                    <h3>${capture.title}</h3>
                    <p>${capture.description || ''}</p>
                    <div class="capture-meta">
                        <span>📍 ${capture.drone_lat?.toFixed(6)}, ${capture.drone_lng?.toFixed(6)}</span>
                        <span>🏷️ ${(capture.tags || []).join(', ')}</span>
                        <span>👁️ ${capture.view_count || 0}</span>
                    </div>
                    <button onclick="captureManager.deleteCapture('${capture.capture_id}')">삭제</button>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// 초기화
const captureManager = new DroneCaptureManager();
captureManager.initialize();
```

## 6. 에러 처리

### 6.1 공통 에러 코드
| 코드 | 설명 | 해결 방법 |
|------|------|-----------|
| 401 | 인증 실패 | API 키 확인 |
| 404 | 리소스 없음 | capture_id 확인 |
| 429 | 요청 제한 초과 | 잠시 후 재시도 |
| 500 | 서버 오류 | 관리자 문의 |

### 6.2 에러 처리 예제
```javascript
const handleAPIError = (error) => {
    console.error('API 에러:', error);
    
    // 사용자 알림
    const notification = {
        401: '인증에 실패했습니다. API 키를 확인해주세요.',
        404: '요청한 캡처를 찾을 수 없습니다.',
        429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        500: '서버 오류가 발생했습니다. 관리자에게 문의해주세요.',
        default: '알 수 없는 오류가 발생했습니다.'
    };
    
    const message = notification[error.status] || notification.default;
    alert(message);
    
    // localStorage 폴백
    if (error.status >= 500) {
        console.log('localStorage 모드로 전환합니다.');
        window.captureStorage.useAPI = false;
    }
};
```

## 7. 성능 최적화

### 7.1 이미지 압축
```javascript
const compressImage = async (base64String, maxWidth = 1920) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // JPEG 품질 80%로 압축
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = base64String;
    });
};
```

### 7.2 페이지네이션
```javascript
class PaginatedCaptureLoader {
    constructor(pageSize = 20) {
        this.pageSize = pageSize;
        this.currentPage = 0;
        this.hasMore = true;
    }
    
    async loadMore() {
        if (!this.hasMore) return [];
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ah_get_captures`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                p_limit: this.pageSize,
                p_offset: this.currentPage * this.pageSize
            })
        });
        
        const data = await response.json();
        
        if (data.length < this.pageSize) {
            this.hasMore = false;
        }
        
        this.currentPage++;
        return data;
    }
}
```

### 7.3 캐싱 전략
```javascript
class CaptureCache {
    constructor(ttl = 5 * 60 * 1000) { // 5분 TTL
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    clear() {
        this.cache.clear();
    }
}

const captureCache = new CaptureCache();
```

## 8. 보안 고려사항

### 8.1 입력 검증
```javascript
const validateCaptureData = (data) => {
    const errors = [];
    
    // 필수 필드 검증
    if (!data.streamKey) errors.push('streamKey는 필수입니다.');
    if (!data.title || data.title.length > 255) errors.push('제목은 1-255자여야 합니다.');
    
    // 이미지 크기 검증 (10MB 제한)
    if (data.imageData) {
        const sizeInBytes = (data.imageData.length * 3) / 4;
        if (sizeInBytes > 10 * 1024 * 1024) {
            errors.push('이미지 크기는 10MB를 초과할 수 없습니다.');
        }
    }
    
    // 드론 데이터 검증
    if (data.droneData) {
        const { lat, lng } = data.droneData;
        if (lat < -90 || lat > 90) errors.push('위도 값이 올바르지 않습니다.');
        if (lng < -180 || lng > 180) errors.push('경도 값이 올바르지 않습니다.');
    }
    
    return errors;
};
```

### 8.2 XSS 방지
```javascript
const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// 사용자 입력 표시 시
element.innerHTML = `<h3>${sanitizeHTML(capture.title)}</h3>`;
```

## 9. 테스트

### 9.1 단위 테스트 예제
```javascript
// Jest 사용 예
describe('Capture API', () => {
    test('캡처 생성 테스트', async () => {
        const capture = {
            capture_id: 'test_001',
            device_id: 'TEST_DEVICE',
            timestamp: new Date().toISOString(),
            stream_key: 'test_stream',
            title: '테스트 캡처'
        };
        
        const result = await createCapture(capture);
        
        expect(result.success).toBe(true);
        expect(result.capture_id).toBe('test_001');
    });
    
    test('캡처 조회 테스트', async () => {
        const captures = await getCaptures({
            stream_key: 'test_stream'
        });
        
        expect(Array.isArray(captures)).toBe(true);
        expect(captures.length).toBeGreaterThan(0);
    });
});
```

### 9.2 통합 테스트 시나리오
```javascript
async function runIntegrationTest() {
    console.log('통합 테스트 시작...');
    
    // 1. 캡처 생성
    const newCapture = await createCapture({
        id: `test_${Date.now()}`,
        title: '통합 테스트 캡처',
        streamKey: 'integration_test'
    });
    console.log('✅ 캡처 생성 성공:', newCapture.capture_id);
    
    // 2. 캡처 조회
    const captures = await getCaptures({
        streamKey: 'integration_test'
    });
    console.log('✅ 캡처 조회 성공:', captures.length, '개');
    
    // 3. 캡처 업데이트
    const updated = await updateCapture(newCapture.capture_id, {
        title: '업데이트된 제목'
    });
    console.log('✅ 캡처 업데이트 성공');
    
    // 4. 캡처 삭제
    const deleted = await deleteCapture(newCapture.capture_id);
    console.log('✅ 캡처 삭제 성공');
    
    console.log('통합 테스트 완료!');
}
```

## 10. 문제 해결

### 10.1 자주 발생하는 문제

#### CORS 오류
```javascript
// 개발 서버에서 프록시 설정
// vite.config.js
export default {
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:17321',
                changeOrigin: true
            }
        }
    }
};
```

#### 대용량 이미지 업로드 실패
```javascript
// 청크 단위 업로드
async function uploadLargeImage(base64Data, chunkSize = 1024 * 1024) {
    const chunks = [];
    for (let i = 0; i < base64Data.length; i += chunkSize) {
        chunks.push(base64Data.slice(i, i + chunkSize));
    }
    
    // 각 청크 업로드
    for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(chunks[i], i, chunks.length);
    }
}
```

### 10.2 디버깅 도구
```javascript
// API 요청 로거
const apiLogger = {
    log: (method, endpoint, data, response) => {
        console.group(`🔵 API ${method}: ${endpoint}`);
        console.log('요청 데이터:', data);
        console.log('응답:', response);
        console.log('시간:', new Date().toISOString());
        console.groupEnd();
    },
    
    error: (method, endpoint, error) => {
        console.group(`🔴 API 오류 ${method}: ${endpoint}`);
        console.error('오류:', error);
        console.log('시간:', new Date().toISOString());
        console.groupEnd();
    }
};
```

## 11. 부록

### 11.1 API 빠른 참조
| 함수명 | 용도 | 주요 파라미터 |
|--------|------|---------------|
| `ah_create_capture` | 캡처 생성 | capture_id, device_id, image_data |
| `ah_get_captures` | 목록 조회 | stream_key, limit, offset |
| `ah_get_capture_by_id` | 단일 조회 | capture_id |
| `ah_update_capture` | 정보 수정 | capture_id, title, tags |
| `ah_delete_capture` | 삭제 | capture_id |
| `ah_batch_create_captures` | 배치 생성 | captures[] |
| `ah_search_captures` | 검색 | search_term, tags |
| `ah_get_capture_stats` | 통계 | device_id, period_days |

### 11.2 상태 코드
| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 201 | 생성 완료 |
| 204 | 콘텐츠 없음 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 찾을 수 없음 |
| 429 | 요청 제한 초과 |
| 500 | 서버 오류 |

### 11.3 유용한 리소스
- [Supabase 문서](https://supabase.com/docs)
- [PostgreSQL 함수 문서](https://www.postgresql.org/docs/)
- [JavaScript Fetch API](https://developer.mozilla.org/ko/docs/Web/API/Fetch_API)

## 12. 지원 및 문의

### 기술 지원
- 이메일: support@ah-drone.com
- 전화: 02-1234-5678
- 업무 시간: 평일 09:00 - 18:00

### 커뮤니티
- GitHub: https://github.com/ah-drone/capture-api
- Discord: https://discord.gg/ah-drone

---

**버전**: 1.0.0  
**최종 업데이트**: 2025-09-13  
**작성자**: AH 드론 개발팀

© 2025 AH Drone Systems. All rights reserved.