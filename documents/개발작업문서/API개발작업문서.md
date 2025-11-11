# API 개발 작업 문서

## 프로젝트 개요
- **프로젝트명**: SinabroG Stream S1 - 캡처 관리 시스템 API 전환
- **작성일**: 2025-09-12
- **목적**: 브라우저 localStorage 기반 캡처 저장 시스템을 서버 API 기반으로 전환

## 1. 현재 시스템 분석

### 1.1 기존 구조
- **저장 방식**: 브라우저 localStorage
- **데이터 형식**: Base64 인코딩된 이미지 + 메타데이터
- **용량 제한**: 브라우저당 5-10MB
- **동기화**: 불가능 (로컬 브라우저에만 저장)

### 1.2 문제점
- 저장 용량 제한으로 대량 캡처 불가
- 다중 디바이스 간 데이터 공유 불가
- 데이터 손실 위험 (브라우저 캐시 삭제 시)
- 백업/복구 어려움

## 2. 요구사항 정의

### 2.1 기능 요구사항

#### 필수 기능
- ✅ 캡처 이미지 저장 (Base64 → 파일 시스템)
- ✅ 캡처 목록 조회
- ✅ 캡처 이미지 다운로드
- ✅ 캡처 삭제
- ⬜ 데이터베이스 연동
- ⬜ 사용자 인증/인가
- ⬜ 캡처 검색 및 필터링

#### 선택 기능
- ⬜ 썸네일 자동 생성
- ⬜ 이미지 압축 최적화
- ⬜ 캡처 공유 기능
- ⬜ 실시간 동기화 (WebSocket)

### 2.2 비기능 요구사항
- **성능**: 5MB 이미지 업로드 3초 이내
- **용량**: 사용자당 최대 10GB 저장
- **동시성**: 100명 동시 접속 지원
- **가용성**: 99.9% 업타임
- **보안**: JWT 인증, HTTPS 통신

## 3. API 명세

### 3.1 인증 API

#### POST /api/auth/login
**설명**: 사용자 로그인 및 JWT 토큰 발급

**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "success": true,
  "token": "jwt_token_string",
  "user": {
    "id": "user_id",
    "username": "string",
    "email": "string"
  }
}
```

#### POST /api/auth/register
**설명**: 새 사용자 등록

**Request**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

### 3.2 캡처 관리 API

#### GET /api/captures
**설명**: 캡처 목록 조회

**Query Parameters**:
- `streamKey` (optional): 특정 스트림 필터링
- `limit` (optional, default: 100): 결과 개수 제한
- `offset` (optional, default: 0): 페이지네이션 오프셋
- `startDate` (optional): 시작 날짜 필터
- `endDate` (optional): 종료 날짜 필터

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "capture_id",
      "streamKey": "stream_key",
      "title": "캡처 제목",
      "thumbnailUrl": "/api/captures/{id}/thumbnail",
      "imageUrl": "/api/captures/{id}/image",
      "timestamp": "2025-09-12T10:30:00Z",
      "droneData": {
        "lat": 37.5665,
        "lng": 126.9780,
        "alt": 150.5,
        "heading": 45
      },
      "metadata": {
        "fileSize": 2048000,
        "width": 1920,
        "height": 1080,
        "mimeType": "image/jpeg"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasNext": true
  }
}
```

#### GET /api/captures/:id
**설명**: 특정 캡처 상세 정보 조회

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "capture_id",
    "streamKey": "stream_key",
    "title": "캡처 제목",
    "description": "캡처 설명",
    "imageUrl": "/api/captures/{id}/image",
    "thumbnailUrl": "/api/captures/{id}/thumbnail",
    "timestamp": "2025-09-12T10:30:00Z",
    "droneData": {
      "lat": 37.5665,
      "lng": 126.9780,
      "alt": 150.5,
      "heading": 45,
      "speed": 25.5,
      "battery": 85
    },
    "metadata": {
      "fileSize": 2048000,
      "width": 1920,
      "height": 1080,
      "mimeType": "image/jpeg",
      "camera": {
        "model": "DJI FC3411",
        "focalLength": 24,
        "iso": 100,
        "shutterSpeed": "1/500"
      }
    },
    "tags": ["aerial", "landscape", "morning"],
    "createdAt": "2025-09-12T10:30:00Z",
    "updatedAt": "2025-09-12T10:30:00Z"
  }
}
```

#### POST /api/captures
**설명**: 새 캡처 생성

**Request** (multipart/form-data):
```
image: File (이미지 파일)
streamKey: string
title: string
description: string (optional)
droneData: JSON string (optional)
tags: string[] (optional)
```

또는 **Request** (application/json):
```json
{
  "imageData": "data:image/jpeg;base64,...",
  "streamKey": "stream_key",
  "title": "캡처 제목",
  "description": "캡처 설명",
  "droneData": {
    "lat": 37.5665,
    "lng": 126.9780,
    "alt": 150.5,
    "heading": 45
  },
  "tags": ["aerial", "landscape"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "new_capture_id",
    "imageUrl": "/api/captures/{id}/image",
    "thumbnailUrl": "/api/captures/{id}/thumbnail",
    "createdAt": "2025-09-12T10:30:00Z"
  }
}
```

#### PUT /api/captures/:id
**설명**: 캡처 정보 수정

**Request**:
```json
{
  "title": "수정된 제목",
  "description": "수정된 설명",
  "tags": ["updated", "tags"],
  "droneData": {
    "lat": 37.5665,
    "lng": 126.9780,
    "alt": 160.0,
    "heading": 50
  }
}
```

#### DELETE /api/captures/:id
**설명**: 특정 캡처 삭제

**Response**:
```json
{
  "success": true,
  "message": "Capture deleted successfully"
}
```

#### GET /api/captures/:id/image
**설명**: 원본 이미지 다운로드

**Query Parameters**:
- `quality` (optional, 1-100): JPEG 품질
- `width` (optional): 리사이즈 너비
- `height` (optional): 리사이즈 높이

**Response**: 이미지 파일 (image/jpeg 또는 image/png)

#### GET /api/captures/:id/thumbnail
**설명**: 썸네일 이미지 조회

**Response**: 썸네일 이미지 (200x200px)

### 3.3 벌크 작업 API

#### POST /api/captures/bulk
**설명**: 여러 캡처 일괄 생성

**Request**:
```json
{
  "captures": [
    {
      "imageData": "data:image/jpeg;base64,...",
      "streamKey": "stream_key",
      "title": "캡처 1"
    },
    {
      "imageData": "data:image/jpeg;base64,...",
      "streamKey": "stream_key",
      "title": "캡처 2"
    }
  ]
}
```

#### DELETE /api/captures/bulk
**설명**: 여러 캡처 일괄 삭제

**Request**:
```json
{
  "captureIds": ["id1", "id2", "id3"]
}
```

### 3.4 통계 API

#### GET /api/captures/stats
**설명**: 캡처 통계 정보 조회

**Response**:
```json
{
  "success": true,
  "data": {
    "totalCaptures": 1500,
    "totalSize": 5368709120,
    "averageSize": 3579139,
    "capturesByStream": {
      "stream_key_1": 500,
      "stream_key_2": 1000
    },
    "capturesByDate": [
      {
        "date": "2025-09-12",
        "count": 50
      }
    ],
    "storageUsage": {
      "used": 5368709120,
      "limit": 10737418240,
      "percentage": 50
    }
  }
}
```

## 4. 데이터베이스 설계

### 4.1 데이터베이스 선택
**MongoDB** (추천) 또는 **PostgreSQL**

### 4.2 MongoDB 스키마

#### users 컬렉션
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  profile: {
    displayName: String,
    avatar: String
  },
  storage: {
    used: Number,
    limit: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### captures 컬렉션
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  captureId: String (unique),
  streamKey: String (indexed),
  title: String,
  description: String,
  imageUrl: String,
  thumbnailUrl: String,
  originalName: String,
  timestamp: Date (indexed),
  droneData: {
    lat: Number,
    lng: Number,
    alt: Number,
    heading: Number,
    speed: Number,
    battery: Number
  },
  metadata: {
    fileSize: Number,
    width: Number,
    height: Number,
    mimeType: String,
    camera: {
      model: String,
      focalLength: Number,
      iso: Number,
      shutterSpeed: String
    }
  },
  tags: [String],
  isPublic: Boolean,
  viewCount: Number,
  createdAt: Date (indexed),
  updatedAt: Date
}

// 인덱스
db.captures.createIndex({ userId: 1, createdAt: -1 })
db.captures.createIndex({ streamKey: 1, timestamp: -1 })
db.captures.createIndex({ tags: 1 })
db.captures.createIndex({ "droneData.lat": 1, "droneData.lng": 1 })
```

#### streams 컬렉션
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  streamKey: String (unique),
  name: String,
  description: String,
  isActive: Boolean,
  startedAt: Date,
  endedAt: Date,
  captureCount: Number,
  metadata: {
    resolution: String,
    framerate: Number,
    codec: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 PostgreSQL 스키마 (대안)

```sql
-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 10737418240,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 스트림 테이블
CREATE TABLE streams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stream_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200),
    description TEXT,
    is_active BOOLEAN DEFAULT false,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    capture_count INTEGER DEFAULT 0,
    resolution VARCHAR(20),
    framerate INTEGER,
    codec VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 캡처 테이블
CREATE TABLE captures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stream_id INTEGER REFERENCES streams(id) ON DELETE SET NULL,
    capture_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200),
    description TEXT,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    original_name VARCHAR(255),
    timestamp TIMESTAMP,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    mime_type VARCHAR(50),
    is_public BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 드론 데이터 테이블
CREATE TABLE drone_data (
    id SERIAL PRIMARY KEY,
    capture_id INTEGER REFERENCES captures(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    altitude DECIMAL(8, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    battery INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 태그 테이블
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 캡처-태그 연결 테이블
CREATE TABLE capture_tags (
    capture_id INTEGER REFERENCES captures(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (capture_id, tag_id)
);

-- 인덱스 생성
CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_stream_id ON captures(stream_id);
CREATE INDEX idx_captures_timestamp ON captures(timestamp DESC);
CREATE INDEX idx_drone_data_coordinates ON drone_data(latitude, longitude);
CREATE INDEX idx_capture_tags_tag_id ON capture_tags(tag_id);
```

## 5. 구현 가이드

### 5.1 기술 스택

#### 백엔드
- **언어**: Node.js (v18+)
- **프레임워크**: Express.js
- **데이터베이스**: MongoDB (Mongoose) 또는 PostgreSQL (Sequelize)
- **인증**: JWT (jsonwebtoken)
- **파일 저장**: 로컬 파일시스템 → AWS S3 (추후)
- **이미지 처리**: Sharp 또는 Jimp
- **검증**: Joi 또는 Express-validator

#### 필수 패키지
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "multer": "^1.4.5",
    "sharp": "^0.32.0",
    "joi": "^17.9.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "winston": "^3.9.0",
    "dotenv": "^16.0.0"
  }
}
```

### 5.2 프로젝트 구조

```
api-server/
├── src/
│   ├── config/
│   │   ├── database.js      # DB 연결 설정
│   │   ├── storage.js       # 파일 저장 설정
│   │   └── auth.js          # 인증 설정
│   ├── models/
│   │   ├── User.js
│   │   ├── Capture.js
│   │   └── Stream.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── captureController.js
│   │   └── streamController.js
│   ├── middlewares/
│   │   ├── auth.js          # JWT 검증
│   │   ├── upload.js        # Multer 설정
│   │   ├── validate.js      # 입력 검증
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── captures.js
│   │   └── streams.js
│   ├── services/
│   │   ├── imageService.js  # 이미지 처리
│   │   ├── storageService.js
│   │   └── captureService.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── helpers.js
│   └── app.js
├── uploads/                  # 임시 업로드 폴더
├── storage/                  # 파일 저장 폴더
│   └── captures/
│       └── 2025/
│           └── 09/
│               └── 12/
├── tests/
├── .env
├── .env.example
├── package.json
└── server.js
```

### 5.3 핵심 코드 예시

#### 인증 미들웨어
```javascript
// middlewares/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### 캡처 컨트롤러
```javascript
// controllers/captureController.js
const Capture = require('../models/Capture');
const imageService = require('../services/imageService');
const storageService = require('../services/storageService');

exports.createCapture = async (req, res) => {
  try {
    const { streamKey, title, description, droneData, tags } = req.body;
    
    let imageUrl, thumbnailUrl;
    
    // 이미지 처리
    if (req.file) {
      // multipart 업로드
      const processedImage = await imageService.processImage(req.file.path);
      imageUrl = await storageService.saveImage(processedImage.full);
      thumbnailUrl = await storageService.saveImage(processedImage.thumbnail);
    } else if (req.body.imageData) {
      // Base64 업로드
      const imageBuffer = Buffer.from(
        req.body.imageData.replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      );
      const processedImage = await imageService.processBuffer(imageBuffer);
      imageUrl = await storageService.saveImage(processedImage.full);
      thumbnailUrl = await storageService.saveImage(processedImage.thumbnail);
    }
    
    // DB 저장
    const capture = new Capture({
      userId: req.userId,
      streamKey,
      title,
      description,
      imageUrl,
      thumbnailUrl,
      droneData: droneData ? JSON.parse(droneData) : null,
      tags,
      metadata: await imageService.getMetadata(imageUrl)
    });
    
    await capture.save();
    
    res.status(201).json({
      success: true,
      data: capture
    });
  } catch (error) {
    console.error('Capture creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

#### 이미지 서비스
```javascript
// services/imageService.js
const sharp = require('sharp');

exports.processImage = async (imagePath) => {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  // 원본 이미지 최적화
  const fullImage = await image
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
  
  // 썸네일 생성
  const thumbnail = await sharp(imagePath)
    .resize(200, 200, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
  
  return {
    full: fullImage,
    thumbnail: thumbnail,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: fullImage.length
    }
  };
};
```

## 6. 보안 구현

### 6.1 보안 체크리스트
- ✅ HTTPS 사용 강제
- ✅ JWT 토큰 만료 시간 설정 (1시간)
- ✅ Refresh 토큰 구현 (7일)
- ✅ 비밀번호 해싱 (bcrypt, rounds: 10)
- ✅ SQL Injection 방지 (파라미터 바인딩)
- ✅ XSS 방지 (입력 값 검증)
- ✅ CORS 설정
- ✅ Rate Limiting
- ✅ 파일 업로드 검증
- ✅ 환경 변수 사용

### 6.2 Rate Limiting 설정
```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 50, // 최대 50개 요청
  message: 'Too many uploads, please try again later'
});

app.use('/api/captures', uploadLimiter);
```

### 6.3 파일 업로드 검증
```javascript
const multer = require('multer');

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  }
});
```

## 7. 성능 최적화

### 7.1 캐싱 전략
```javascript
// Redis 캐싱
const redis = require('redis');
const client = redis.createClient();

// 캡처 목록 캐싱
exports.getCapturesWithCache = async (req, res) => {
  const cacheKey = `captures:${req.userId}:${req.query.streamKey || 'all'}`;
  
  // 캐시 확인
  const cached = await client.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // DB 조회
  const captures = await Capture.find({ userId: req.userId });
  
  // 캐시 저장 (5분)
  await client.setex(cacheKey, 300, JSON.stringify(captures));
  
  res.json(captures);
};
```

### 7.2 이미지 CDN 설정
```javascript
// CloudFront 또는 Cloudflare CDN 사용
const CDN_URL = process.env.CDN_URL || 'https://cdn.example.com';

exports.getCaptureWithCDN = (capture) => {
  return {
    ...capture.toObject(),
    imageUrl: `${CDN_URL}${capture.imageUrl}`,
    thumbnailUrl: `${CDN_URL}${capture.thumbnailUrl}`
  };
};
```

### 7.3 데이터베이스 최적화
- 적절한 인덱스 생성
- 페이지네이션 구현
- Projection 사용 (필요한 필드만 조회)
- Aggregation Pipeline 활용

## 8. 모니터링 및 로깅

### 8.1 로깅 설정
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### 8.2 모니터링 항목
- API 응답 시간
- 에러율
- 활성 사용자 수
- 저장소 사용량
- 데이터베이스 성능

### 8.3 헬스체크 엔드포인트
```javascript
app.get('/health', async (req, res) => {
  try {
    // DB 연결 체크
    await mongoose.connection.db.admin().ping();
    
    // 저장소 체크
    const storageStats = await storageService.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: 'connected',
      storage: storageStats
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

## 9. 테스트

### 9.1 단위 테스트
```javascript
// tests/capture.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Capture API', () => {
  let authToken;
  
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpass'
      });
    authToken = res.body.token;
  });
  
  test('POST /api/captures - should create capture', async () => {
    const res = await request(app)
      .post('/api/captures')
      .set('Authorization', `Bearer ${authToken}`)
      .field('streamKey', 'test-stream')
      .field('title', 'Test Capture')
      .attach('image', 'tests/fixtures/test-image.jpg');
    
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
  });
  
  test('GET /api/captures - should list captures', async () => {
    const res = await request(app)
      .get('/api/captures')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});
```

### 9.2 통합 테스트
- 전체 워크플로우 테스트
- 에러 시나리오 테스트
- 동시성 테스트

### 9.3 부하 테스트
```bash
# Artillery 사용
npm install -g artillery

# 부하 테스트 실행
artillery quick --count 100 --num 10 \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/captures
```

## 10. 배포

### 10.1 환경 변수 설정
```env
# .env.production
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/capture_db
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
STORAGE_PATH=/var/app/storage
CDN_URL=https://cdn.example.com
REDIS_URL=redis://localhost:6379
```

### 10.2 Docker 컨테이너화
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p /app/storage/captures

EXPOSE 3000

USER node

CMD ["node", "server.js"]
```

### 10.3 Docker Compose
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/capture_db
    volumes:
      - ./storage:/app/storage
    depends_on:
      - mongo
      - redis
  
  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mongo_data:
```

## 11. 마이그레이션 계획

### 11.1 Phase 1: 개발 (1주)
- [ ] API 서버 구축
- [ ] 데이터베이스 설정
- [ ] 인증 시스템 구현
- [ ] 캡처 CRUD API 구현

### 11.2 Phase 2: 테스트 (3-4일)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 실행
- [ ] 부하 테스트
- [ ] 보안 테스트

### 11.3 Phase 3: 마이그레이션 (2-3일)
- [ ] 기존 localStorage 데이터 추출 스크립트
- [ ] 데이터 변환 및 업로드
- [ ] 프론트엔드 코드 수정
- [ ] 병렬 운영 테스트

### 11.4 Phase 4: 배포 (1-2일)
- [ ] 프로덕션 환경 설정
- [ ] 배포 자동화 구성
- [ ] 모니터링 설정
- [ ] 롤백 계획 수립

## 12. 예상 비용

### 12.1 인프라 비용 (월간)
- **서버**: AWS EC2 t3.medium ($30/월)
- **데이터베이스**: MongoDB Atlas M10 ($60/월)
- **저장소**: AWS S3 100GB ($2.3/월)
- **CDN**: CloudFront 100GB 전송 ($8.5/월)
- **합계**: 약 $100/월

### 12.2 확장 시나리오
| 사용자 수 | 서버 | DB | 저장소 | CDN | 월 비용 |
|----------|------|-----|--------|-----|---------|
| 100명 | t3.medium | M10 | 100GB | 100GB | $100 |
| 1,000명 | t3.large | M20 | 1TB | 1TB | $300 |
| 10,000명 | 2x t3.xlarge | M30 | 10TB | 10TB | $1,000 |

## 13. 리스크 및 대응방안

### 13.1 기술적 리스크
| 리스크 | 영향도 | 발생확률 | 대응방안 |
|--------|--------|----------|----------|
| DB 장애 | 높음 | 낮음 | 백업 및 복제 설정 |
| 대용량 트래픽 | 중간 | 중간 | Auto-scaling 설정 |
| 보안 침해 | 높음 | 낮음 | 보안 감사 및 모니터링 |
| 데이터 손실 | 높음 | 낮음 | 정기 백업 및 복구 테스트 |

### 13.2 비즈니스 리스크
- 사용자 데이터 마이그레이션 실패
- 서비스 중단
- 비용 초과

## 14. 성공 지표 (KPI)

### 14.1 기술 지표
- API 응답 시간 < 200ms (95 percentile)
- 가동률 > 99.9%
- 에러율 < 0.1%
- 동시 접속자 > 100명

### 14.2 비즈니스 지표
- 일일 활성 사용자 (DAU)
- 캡처 생성 수/일
- 저장 용량 증가율
- 사용자 만족도

## 15. 참고 자료

### 15.1 문서
- [Express.js 공식 문서](https://expressjs.com/)
- [MongoDB 모범 사례](https://www.mongodb.com/docs/manual/best-practices/)
- [JWT 인증 가이드](https://jwt.io/introduction)
- [OWASP API 보안 Top 10](https://owasp.org/www-project-api-security/)

### 15.2 도구
- [Postman](https://www.postman.com/) - API 테스트
- [MongoDB Compass](https://www.mongodb.com/products/compass) - DB 관리
- [Redis Commander](https://github.com/joeferner/redis-commander) - Redis 관리
- [PM2](https://pm2.keymetrics.io/) - 프로세스 관리

### 15.3 모니터링
- [New Relic](https://newrelic.com/) - APM
- [Datadog](https://www.datadoghq.com/) - 인프라 모니터링
- [Sentry](https://sentry.io/) - 에러 트래킹
- [Grafana](https://grafana.com/) - 메트릭 시각화

---

**작성자**: SinabroG Stream 개발팀  
**작성일**: 2025-09-12  
**버전**: 1.0.0  
**상태**: 검토 중

## 부록 A: API 응답 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 완료 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복) |
| 413 | 파일 크기 초과 |
| 429 | 요청 제한 초과 |
| 500 | 서버 오류 |
| 503 | 서비스 이용 불가 |

## 부록 B: 에러 응답 형식

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  },
  "timestamp": "2025-09-12T10:30:00Z",
  "path": "/api/captures"
}
```

## 부록 C: 개발 체크리스트

### 백엔드 개발
- [ ] 프로젝트 초기 설정
- [ ] 데이터베이스 연결
- [ ] 모델 정의
- [ ] 인증 시스템
- [ ] 파일 업로드
- [ ] 이미지 처리
- [ ] API 엔드포인트
- [ ] 입력 검증
- [ ] 에러 처리
- [ ] 로깅
- [ ] 테스트
- [ ] 문서화

### 보안
- [ ] HTTPS 설정
- [ ] CORS 설정
- [ ] Rate Limiting
- [ ] 입력 검증
- [ ] SQL Injection 방지
- [ ] XSS 방지
- [ ] 파일 업로드 검증
- [ ] JWT 구현
- [ ] 비밀번호 해싱

### 성능
- [ ] 캐싱 구현
- [ ] 이미지 최적화
- [ ] 데이터베이스 인덱싱
- [ ] 페이지네이션
- [ ] 압축
- [ ] CDN 설정

### 배포
- [ ] 환경 변수 설정
- [ ] Docker 이미지 빌드
- [ ] CI/CD 파이프라인
- [ ] 모니터링 설정
- [ ] 백업 설정
- [ ] 로그 수집
- [ ] 헬스체크