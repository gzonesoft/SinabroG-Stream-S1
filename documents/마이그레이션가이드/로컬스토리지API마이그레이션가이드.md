# localStorage → API 마이그레이션 가이드

## 1. 개요

### 1.1 현재 상황
- **사용 위치**: `public/camera.html`, `public/viewer.js`
- **저장 데이터**: 스트림 캡처 이미지 및 메타데이터
- **저장 키**: `streamCaptures`
- **데이터 구조**: 캡처 객체 배열 (JSON)

### 1.2 마이그레이션 목적
- 브라우저 저장 용량 한계 극복 (5-10MB 제한)
- 여러 디바이스 간 데이터 동기화
- 중앙 집중식 데이터 관리
- 데이터 백업 및 복구 용이성
- 보안 강화

## 2. 현재 localStorage 사용 분석

### 2.1 데이터 구조
```javascript
// streamCaptures 배열 내 각 객체 구조
{
    id: string,           // 고유 ID (timestamp 기반)
    timestamp: number,    // 캡처 시간
    imageData: string,    // Base64 인코딩된 이미지 데이터
    streamKey: string,    // 스트림 키
    title: string,        // 캡처 제목
    droneData: {         // 드론 정보 (선택)
        lat: number,
        lng: number,
        alt: number,
        heading: number
    }
}
```

### 2.2 주요 작업 패턴

#### 읽기 작업
- **camera.html:210, 254**: 초기 로드 및 갱신
- **viewer.js:752, 792, 844, 918, 1174, 1185, 1228, 1964**: 캡처 목록 조회

#### 쓰기 작업
- **camera.html:455**: 새 캡처 저장
- **viewer.js:1176, 1982**: 캡처 추가/업데이트

#### 삭제 작업
- **viewer.js:1237**: 전체 캡처 삭제
- **viewer.js:1174-1176**: 개별 캡처 삭제

## 3. API 설계

### 3.1 엔드포인트 구조

```
GET    /api/captures              # 캡처 목록 조회
GET    /api/captures/:id          # 특정 캡처 조회
POST   /api/captures              # 새 캡처 생성
PUT    /api/captures/:id          # 캡처 업데이트
DELETE /api/captures/:id          # 캡처 삭제
DELETE /api/captures              # 전체 캡처 삭제
GET    /api/captures/stream/:key  # 특정 스트림의 캡처 조회
```

### 3.2 데이터베이스 스키마

#### MongoDB 컬렉션: captures
```javascript
{
    _id: ObjectId,
    captureId: String,        // 기존 ID 유지
    timestamp: Date,
    streamKey: String,
    title: String,
    imageUrl: String,         // S3/파일시스템 경로
    thumbnailUrl: String,     // 썸네일 경로
    droneData: {
        lat: Number,
        lng: Number,
        alt: Number,
        heading: Number
    },
    metadata: {
        fileSize: Number,
        mimeType: String,
        width: Number,
        height: Number
    },
    createdAt: Date,
    updatedAt: Date
}
```

## 4. 구현 계획

### 4.1 백엔드 구현

#### Phase 1: API 서버 구축
```javascript
// capture-api.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// 파일 저장 설정
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads/captures');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `capture-${uniqueSuffix}.jpg`);
    }
});

const upload = multer({ storage });

// 메모리 기반 임시 저장소 (추후 DB 연결)
let capturesDB = [];

// 캡처 목록 조회
router.get('/captures', async (req, res) => {
    try {
        const { streamKey, limit = 100, offset = 0 } = req.query;
        
        let captures = [...capturesDB];
        
        if (streamKey) {
            captures = captures.filter(c => c.streamKey === streamKey);
        }
        
        captures = captures
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(offset, offset + limit);
        
        res.json({
            success: true,
            data: captures,
            total: capturesDB.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 새 캡처 생성
router.post('/captures', upload.single('image'), async (req, res) => {
    try {
        const { streamKey, title, droneData, imageData } = req.body;
        
        let imageUrl;
        
        // Base64 이미지 처리
        if (imageData && !req.file) {
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const filename = `capture-${Date.now()}.jpg`;
            const filepath = path.join(__dirname, 'uploads/captures', filename);
            
            await fs.writeFile(filepath, buffer);
            imageUrl = `/uploads/captures/${filename}`;
        } else if (req.file) {
            imageUrl = `/uploads/captures/${req.file.filename}`;
        }
        
        const capture = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            streamKey,
            title,
            imageUrl,
            droneData: droneData ? JSON.parse(droneData) : null,
            createdAt: new Date()
        };
        
        capturesDB.push(capture);
        
        res.json({ success: true, data: capture });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 캡처 삭제
router.delete('/captures/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const index = capturesDB.findIndex(c => c.id === id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Capture not found' });
        }
        
        const capture = capturesDB[index];
        
        // 파일 삭제
        if (capture.imageUrl) {
            const filepath = path.join(__dirname, capture.imageUrl);
            await fs.unlink(filepath).catch(() => {});
        }
        
        capturesDB.splice(index, 1);
        
        res.json({ success: true, message: 'Capture deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
```

### 4.2 프론트엔드 마이그레이션

#### Phase 2: API 클라이언트 구현
```javascript
// capture-api-client.js
class CaptureAPIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
    }
    
    // localStorage 호환 인터페이스
    async getCaptures(streamKey = null) {
        try {
            const params = streamKey ? `?streamKey=${streamKey}` : '';
            const response = await fetch(`${this.baseURL}/api/captures${params}`);
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            }
            
            // Fallback to localStorage
            return JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        } catch (error) {
            console.error('API 오류, localStorage 사용:', error);
            return JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        }
    }
    
    async saveCapture(capture) {
        try {
            const formData = new FormData();
            
            // Base64 이미지를 Blob으로 변환
            if (capture.imageData) {
                const base64Data = capture.imageData.split(',')[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });
                
                formData.append('image', blob, 'capture.jpg');
            }
            
            formData.append('streamKey', capture.streamKey || '');
            formData.append('title', capture.title || '');
            formData.append('droneData', JSON.stringify(capture.droneData || {}));
            
            const response = await fetch(`${this.baseURL}/api/captures`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            }
            
            // Fallback to localStorage
            const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures.push(capture);
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            
            return capture;
        } catch (error) {
            console.error('API 저장 실패, localStorage 사용:', error);
            
            const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures.push(capture);
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            
            return capture;
        }
    }
    
    async deleteCapture(captureId) {
        try {
            const response = await fetch(`${this.baseURL}/api/captures/${captureId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return true;
        } catch (error) {
            console.error('API 삭제 실패, localStorage 사용:', error);
            
            let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures = captures.filter(c => c.id !== captureId);
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            
            return true;
        }
    }
    
    async clearAllCaptures() {
        try {
            const response = await fetch(`${this.baseURL}/api/captures`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            return true;
        } catch (error) {
            console.error('API 전체 삭제 실패:', error);
            localStorage.removeItem('streamCaptures');
            return true;
        }
    }
}

// 전역 객체로 등록
window.captureAPI = new CaptureAPIClient();
```

### 4.3 코드 변경 사항

#### camera.html 수정
```javascript
// 기존 코드 (210번 줄)
// this.captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');

// 변경 후
this.captures = await window.captureAPI.getCaptures(this.currentStreamKey);

// 기존 코드 (455번 줄)
// localStorage.setItem('streamCaptures', JSON.stringify(this.captures));

// 변경 후
await window.captureAPI.saveCapture(newCapture);
```

#### viewer.js 수정
```javascript
// 기존 코드 (1174-1176번 줄)
// let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
// captures = captures.filter(c => c.id !== captureId);
// localStorage.setItem('streamCaptures', JSON.stringify(captures));

// 변경 후
await window.captureAPI.deleteCapture(captureId);

// 기존 코드 (1237번 줄)
// localStorage.removeItem('streamCaptures');

// 변경 후
await window.captureAPI.clearAllCaptures();
```

## 5. 마이그레이션 단계

### Phase 1: 준비 단계 (1-2일)
1. API 서버 구축 및 테스트
2. 파일 저장소 설정 (로컬/S3)
3. 데이터베이스 설정 (MongoDB/PostgreSQL)

### Phase 2: 병렬 운영 (3-5일)
1. API 클라이언트 구현
2. localStorage와 API 동시 사용 (Fallback)
3. 기존 데이터 마이그레이션 스크립트 작성

### Phase 3: 전환 단계 (1-2일)
1. 기존 localStorage 데이터 → API 일괄 마이그레이션
2. 프론트엔드 코드 완전 전환
3. localStorage 의존성 제거

### Phase 4: 최적화 (2-3일)
1. 이미지 압축 및 썸네일 생성
2. 캐싱 구현
3. 페이지네이션 최적화
4. 에러 핸들링 강화

## 6. 성능 고려사항

### 6.1 이미지 최적화
- 원본 이미지와 썸네일 분리 저장
- WebP 포맷 지원 추가
- Progressive JPEG 사용
- CDN 활용

### 6.2 API 최적화
- 페이지네이션 구현
- 캐싱 전략 (Redis)
- 압축 전송 (gzip)
- 비동기 처리

### 6.3 프론트엔드 최적화
- Lazy Loading
- Virtual Scrolling
- 이미지 프리로딩
- 낙관적 업데이트

## 7. 보안 고려사항

### 7.1 인증/인가
```javascript
// JWT 기반 인증
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};
```

### 7.2 데이터 검증
- 입력 데이터 유효성 검증
- 파일 타입 검증
- 파일 크기 제한
- SQL Injection 방지

### 7.3 접근 제어
- CORS 설정
- Rate Limiting
- IP 화이트리스트

## 8. 모니터링 및 로깅

### 8.1 로깅 구현
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
```

### 8.2 모니터링 항목
- API 응답 시간
- 에러율
- 저장소 사용량
- 동시 접속자 수

## 9. 롤백 계획

### 9.1 데이터 백업
- localStorage 데이터 백업
- API 데이터 정기 백업
- 이미지 파일 백업

### 9.2 롤백 절차
1. API 서버 중지
2. 프론트엔드 코드 이전 버전 복원
3. localStorage 데이터 복원
4. 서비스 재시작

## 10. 테스트 계획

### 10.1 단위 테스트
```javascript
// capture-api.test.js
describe('Capture API', () => {
    test('should create new capture', async () => {
        const capture = {
            streamKey: 'test-key',
            title: 'Test Capture',
            imageData: 'data:image/jpeg;base64,...'
        };
        
        const response = await request(app)
            .post('/api/captures')
            .send(capture);
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
```

### 10.2 통합 테스트
- 전체 워크플로우 테스트
- 에러 시나리오 테스트
- 성능 테스트
- 보안 테스트

## 11. 예상 이슈 및 해결방안

### 11.1 대용량 이미지 처리
**문제**: Base64 인코딩된 대용량 이미지 전송 시 메모리 문제  
**해결**: 
- Streaming 업로드 구현
- 청크 단위 전송
- 클라이언트 측 이미지 압축

### 11.2 동시성 문제
**문제**: 동시 다발적인 캡처 저장 시 충돌  
**해결**:
- 트랜잭션 사용
- 낙관적 락 구현
- 큐 시스템 도입

### 11.3 네트워크 장애
**문제**: API 서버 접속 불가 시 데이터 손실  
**해결**:
- localStorage 임시 저장
- 재시도 로직 구현
- 오프라인 모드 지원

## 12. 추가 개선사항

### 12.1 향후 기능
- 실시간 동기화 (WebSocket)
- 공유 기능
- 태그 및 검색
- 분석 대시보드

### 12.2 확장성
- 마이크로서비스 아키텍처
- 컨테이너화 (Docker)
- 오케스트레이션 (Kubernetes)
- Auto-scaling

## 13. 참고 자료

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Best Practices](https://www.mongodb.com/docs/manual/best-practices/)
- [Image Optimization Guide](https://web.dev/fast/#optimize-your-images)
- [JWT Authentication](https://jwt.io/introduction)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)

---

작성일: 2025-09-12  
버전: 1.0.0