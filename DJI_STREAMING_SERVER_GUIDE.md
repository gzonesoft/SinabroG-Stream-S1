# 🚁 DJI 드론 실시간 스트리밍 서버 구축 가이드

## 📋 목차
1. [프로젝트 구조](#프로젝트-구조)
2. [기본 설정](#기본-설정)
3. [서버 구축](#서버-구축)
4. [SSL 인증서 설정](#ssl-인증서-설정)
5. [DJI 드론 연동](#dji-드론-연동)
6. [웹 인터페이스](#웹-인터페이스)
7. [배포 및 관리](#배포-및-관리)

---

## 🗂️ 프로젝트 구조

```
dji-streaming-server/
├── package.json              # 프로젝트 설정 및 의존성
├── server.js                 # 메인 서버 파일
├── public/                   # 웹 리소스
│   ├── index.html           # 관리자 대시보드
│   ├── watch.html           # 시청자 페이지
│   ├── simple.html          # 간단 시청 페이지
│   ├── script.js            # 관리자 JavaScript
│   ├── viewer.js            # 시청자 JavaScript
│   └── style.css            # 스타일시트
├── media/                    # 미디어 파일 저장소
├── README.md                 # 프로젝트 문서
├── TROUBLESHOOTING.md        # 문제 해결 가이드
└── .gitignore               # Git 제외 파일
```

---

## ⚙️ 기본 설정

### 1.1 새 프로젝트 생성

```bash
# 프로젝트 디렉토리 생성
mkdir dji-streaming-server
cd dji-streaming-server

# Node.js 프로젝트 초기화
npm init -y
```

### 1.2 package.json 설정

```json
{
  "name": "dji-streaming-server",
  "version": "1.0.0",
  "description": "DJI Drone Real-time Streaming Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "stop": "lsof -ti:17935,17936,17937,18001,18002 | xargs kill -9"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-media-server": "^2.4.9",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": [
    "dji",
    "drone",
    "streaming",
    "rtmp",
    "nodejs"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

### 1.3 의존성 설치

```bash
npm install
```

---

## 🚀 서버 구축

### 2.1 메인 서버 파일 (server.js)

```javascript
const express = require('express');
const NodeMediaServer = require('node-media-server');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// SSL 인증서 설정 (실제 경로로 수정 필요)
let sslOptions = null;
try {
  sslOptions = {
    key: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.key'),
    cert: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.crt'),
    passphrase: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/password.txt', 'utf8').trim()
  };
} catch (error) {
  console.log('⚠️ SSL certificates not found, running HTTP only');
}

// HTTP와 HTTPS 서버 생성
const httpServer = http.createServer(app);
const httpsServer = sslOptions ? https.createServer(sslOptions, app) : null;

// Socket.IO 서버 (HTTPS가 있으면 HTTPS, 없으면 HTTP)
const io = socketIo(httpsServer || httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 미들웨어 설정
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 추가 CORS 헤더
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// RTMP 서버 설정
const rtmpConfig = {
  rtmp: {
    port: 17935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 18001,
    allow_origin: '*',
    mediaroot: './media'
  }
};

// HTTPS-FLV 서버 추가 (SSL 인증서가 있는 경우)
if (sslOptions) {
  rtmpConfig.https = {
    port: 18002,
    key: '/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.key',
    cert: '/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.crt',
    passphrase: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/password.txt', 'utf8').trim()
  };
}

const nms = new NodeMediaServer(rtmpConfig);

// 활성 스트림 추적
let activeStreams = new Map();
let streamStats = new Map();

// RTMP 이벤트 처리
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // 스트림 키 검증 및 추출
  let streamKey = StreamPath.split('/').pop();
  
  // 빈 스트림 키 처리 (DJI RC2 호환성)
  if (!streamKey || streamKey === '') {
    streamKey = `stream_${Date.now()}`;
    console.log(`[WARN] Empty stream key detected, assigned: ${streamKey}`);
  }
  
  // 스트림 매핑 정보 생성
  const mappedPath = `/live/${streamKey}`;
  console.log(`[INFO] Stream mapping: ${StreamPath} -> ${mappedPath} (key: ${streamKey})`);
  
  activeStreams.set(id, {
    streamPath: StreamPath,
    mappedPath: mappedPath,
    streamKey: streamKey,
    startTime: new Date(),
    viewers: 0
  });
  
  // 클라이언트에 스트림 시작 알림
  io.emit('streamStarted', {
    id: id,
    streamPath: StreamPath,
    mappedPath: mappedPath,
    streamKey: streamKey,
    startTime: new Date()
  });
  
  console.log(`[INFO] Stream started: ${streamKey} (ID: ${id})`);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  activeStreams.delete(id);
  streamStats.delete(id);
  
  // 클라이언트에 스트림 종료 알림
  io.emit('streamEnded', {
    id: id,
    streamPath: StreamPath
  });
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // 시청자 수 증가 로깅
  console.log(`[INFO] Viewer joined stream: ${StreamPath.split('/').pop()} (viewers: ${getViewerCount(StreamPath) + 1})`);
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

// 시청자 수 계산 헬퍼 함수
function getViewerCount(streamPath) {
  let count = 0;
  for (let [id, stream] of activeStreams) {
    if (stream.streamPath === streamPath || stream.mappedPath === streamPath) {
      count = stream.viewers || 0;
      break;
    }
  }
  return count;
}

// API 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 시청자용 페이지들
app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple.html'));
});

// 활성 스트림 목록 API
app.get('/api/streams', (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
    id,
    ...stream
  }));
  res.json(streams);
});

// 스트림 상태 API
app.get('/api/streams/:id', (req, res) => {
  const streamId = req.params.id;
  if (activeStreams.has(streamId)) {
    res.json(activeStreams.get(streamId));
  } else {
    res.status(404).json({ error: 'Stream not found' });
  }
});

// 스트림 키 생성 API
app.post('/api/generate-key', (req, res) => {
  const streamKey = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
  res.json({ streamKey });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // 현재 활성 스트림 전송
  socket.emit('activeStreams', Array.from(activeStreams.entries()).map(([id, stream]) => ({
    id,
    ...stream
  })));
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// HTTP → HTTPS 리다이렉트 (HTTPS 서버가 있는 경우)
if (httpsServer) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && req.secure === false) {
      return res.redirect(301, `https://${req.header('host').replace(':17936', ':17937')}${req.url}`);
    }
    next();
  });
}

// 서버 시작
const HTTP_PORT = process.env.HTTP_PORT || 17936;
const HTTPS_PORT = process.env.HTTPS_PORT || 17937;

// HTTP 서버 시작
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on port ${HTTP_PORT}${httpsServer ? ' (redirects to HTTPS)' : ''}`);
});

// HTTPS 서버 시작 (인증서가 있는 경우)
if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS server running on port ${HTTPS_PORT}`);
  });
}

// RTMP 서버 시작
nms.run();

console.log('DJI Drone Streaming Service Started!');
console.log('==========================================');
console.log(`RTMP URL: rtmp://your-domain.com:17935/live`);
console.log(`HTTP Interface: http://your-domain.com:${HTTP_PORT}`);
if (httpsServer) {
  console.log(`HTTPS Interface: https://your-domain.com:${HTTPS_PORT}`);
  console.log(`HTTPS-FLV Stream: https://your-domain.com:18002/live/[key].flv`);
}
console.log(`HTTP-FLV Stream: http://your-domain.com:18001/live/[key].flv`);
console.log('==========================================');
```

### 2.2 미디어 디렉토리 생성

```bash
mkdir media
```

---

## 🔒 SSL 인증서 설정

### 3.1 Let's Encrypt 인증서 생성 (권장)

```bash
# Certbot 설치 (macOS)
brew install certbot

# 도메인 인증서 발급
sudo certbot certonly --standalone -d your-domain.com

# 생성된 인증서 경로 확인
ls /etc/letsencrypt/live/your-domain.com/
```

### 3.2 server.js에서 SSL 경로 수정

```javascript
// SSL 인증서 설정 (Let's Encrypt 사용시)
let sslOptions = null;
try {
  sslOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/fullchain.pem')
  };
} catch (error) {
  console.log('⚠️ SSL certificates not found, running HTTP only');
}
```

### 3.3 자체 서명 인증서 생성 (개발용)

```bash
# 개발용 자체 서명 인증서 생성
mkdir ssl
cd ssl

# 개인키 생성
openssl genrsa -out privatekey.pem 2048

# 인증서 생성
openssl req -new -x509 -key privatekey.pem -out certificate.pem -days 365

# server.js에서 경로 설정
# key: './ssl/privatekey.pem'
# cert: './ssl/certificate.pem'
```

---

## 🚁 DJI 드론 연동

### 4.1 DJI RC2 설정

#### 4.1.1 DJI Fly 앱에서 RTMP 설정
1. **DJI Fly 앱** 실행
2. **카메라 뷰** → **전송** 아이콘
3. **라이브 스트리밍 플랫폼** → **RTMP** 선택
4. **RTMP 주소** 입력:
   ```
   rtmp://your-domain.com:17935/live/[스트림키]
   ```

#### 4.1.2 최적 설정 값
```javascript
// DJI RC2 최적화 설정
const DJI_RC2_CONFIG = {
  resolution: '720p',        // RC2 최대 해상도
  framerate: 30,            // 안정적인 프레임레이트
  bitrate: 2000,            // 2Mbps (RC2 권장)
  audioRequired: true,      // 마이크 필수 연결
  codec: 'H.264'           // 호환성
};
```

### 4.2 DJI RC Pro 설정

#### 4.2.1 고화질 스트리밍 지원
```javascript
// DJI RC Pro 최적화 설정
const DJI_RC_PRO_CONFIG = {
  resolution: '4K',         // RC Pro 4K 지원
  framerate: 60,           // 고프레임레이트
  bitrate: 15000,          // 15Mbps
  protocols: ['RTMP', 'WebRTC', 'SRT'],
  latency: 'low'           // 저지연 모드
};
```

### 4.3 DJI Smart Controller 설정

```javascript
// DJI Smart Controller 최적화 설정
const DJI_SMART_CONTROLLER_CONFIG = {
  resolution: '1080p',
  framerate: 30,
  bitrate: 8000,           // 8Mbps
  protocols: ['RTMP', 'RTMPS']
};
```

---

## 🌐 웹 인터페이스

### 5.1 public 디렉토리 생성

```bash
mkdir public
```

### 5.2 관리자 대시보드 (public/index.html)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DJI 드론 스트리밍 관리자</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="style.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="#">
                <i class="fas fa-broadcast-tower me-2"></i>
                DJI 드론 스트리밍 서비스
            </a>
            <div class="navbar-nav ms-auto">
                <a href="/watch" class="nav-link me-3" target="_blank">
                    <i class="fas fa-external-link-alt me-1"></i>
                    시청 페이지
                </a>
                <span class="navbar-text">
                    <i class="fas fa-circle text-success me-1"></i>
                    <span id="connectionStatus">연결됨</span>
                </span>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <!-- 대시보드 통계 -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">활성 스트림</h6>
                                <h3 id="activeStreamsCount">0</h3>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-video fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">총 시청자</h6>
                                <h3 id="totalViewers">0</h3>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-users fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">RTMP 포트</h6>
                                <h3>17935</h3>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-satellite-dish fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">업타임</h6>
                                <h3 id="uptime">00:00:00</h3>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-clock fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- DJI 드론 설정 -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-helicopter me-2"></i>
                            DJI 드론 RTMP 설정
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">RTMP URL (DJI Fly 앱용)</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="rtmpUrl" value="rtmp://your-domain.com:17935/live" readonly>
                                <button class="btn btn-outline-secondary" type="button" onclick="copyToClipboard('rtmpUrl')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">스트림 키</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="streamKey" placeholder="스트림 키 생성">
                                <button class="btn btn-primary" type="button" onclick="generateStreamKey()">
                                    키 생성
                                </button>
                                <button class="btn btn-outline-secondary" type="button" onclick="copyToClipboard('streamKey')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="alert alert-info">
                            <h6><i class="fas fa-info-circle me-2"></i>DJI RC2 설정 방법:</h6>
                            <ol class="mb-0">
                                <li>DJI Fly 앱에서 <strong>전송</strong> → <strong>RTMP</strong> 선택</li>
                                <li>위의 RTMP URL과 스트림 키 입력</li>
                                <li><strong>마이크 연결 필수</strong> (RC2 요구사항)</li>
                                <li>720p, 30fps, 2Mbps 권장</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-eye me-2"></i>
                            스트림 시청
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label">시청할 스트림 키</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="playStreamKey" placeholder="스트림 키 입력">
                                <button class="btn btn-success" type="button" onclick="watchStream()">
                                    시청
                                </button>
                            </div>
                        </div>
                        <div class="d-grid gap-2">
                            <a href="/simple" target="_blank" class="btn btn-outline-primary">
                                <i class="fas fa-external-link-alt me-2"></i>
                                간단 시청 페이지
                            </a>
                            <a href="/watch" target="_blank" class="btn btn-outline-info">
                                <i class="fas fa-desktop me-2"></i>
                                고급 시청 페이지
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 활성 스트림 목록 -->
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">
                            <i class="fas fa-list me-2"></i>
                            활성 DJI 드론 스트림
                        </h5>
                        <button class="btn btn-sm btn-outline-primary" onclick="refreshStreams()">
                            <i class="fas fa-sync-alt me-1"></i>
                            새로고침
                        </button>
                    </div>
                    <div class="card-body">
                        <div id="streamsList">
                            <div class="text-center text-muted py-4">
                                <i class="fas fa-helicopter fa-3x mb-3"></i>
                                <p>현재 활성 DJI 드론 스트림이 없습니다</p>
                                <small>DJI Fly 앱에서 RTMP 스트리밍을 시작하세요</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

### 5.3 기본 스타일 (public/style.css)

```css
body {
    background-color: #f8f9fa;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.card {
    border: none;
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    transition: transform 0.15s ease-in-out;
}

.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.stream-item {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: #fff;
    transition: all 0.2s ease-in-out;
}

.stream-item:hover {
    border-color: #0d6efd;
    box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
}

.stream-status.live {
    background-color: #dc3545;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: bold;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
```

---

## 📁 추가 파일 생성

### 6.1 시청 페이지 기본 JavaScript (public/script.js)

```javascript
// 기본 관리자 JavaScript
class StreamingManager {
    constructor() {
        this.socket = null;
        this.activeStreams = [];
        this.startTime = new Date();
        this.init();
    }
    
    init() {
        this.connectSocket();
        this.updateUptime();
        this.generateStreamKey();
    }
    
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('activeStreams', (streams) => {
            this.activeStreams = streams;
            this.updateStreamsList();
            this.updateStats();
        });
        
        this.socket.on('streamStarted', (streamInfo) => {
            console.log('New stream started:', streamInfo);
            this.refreshStreams();
        });
        
        this.socket.on('streamEnded', (streamInfo) => {
            console.log('Stream ended:', streamInfo);
            this.refreshStreams();
        });
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = connected ? '연결됨' : '연결 해제됨';
            statusElement.className = connected ? 'text-success' : 'text-danger';
        }
    }
    
    updateUptime() {
        setInterval(() => {
            const now = new Date();
            const diff = now - this.startTime;
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) {
                uptimeElement.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    updateStats() {
        const activeCount = this.activeStreams.length;
        const totalViewers = this.activeStreams.reduce((total, stream) => total + (stream.viewers || 0), 0);
        
        const countElement = document.getElementById('activeStreamsCount');
        const viewersElement = document.getElementById('totalViewers');
        
        if (countElement) countElement.textContent = activeCount;
        if (viewersElement) viewersElement.textContent = totalViewers;
    }
    
    async generateStreamKey() {
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            
            const keyElement = document.getElementById('streamKey');
            if (keyElement) {
                keyElement.value = data.streamKey;
            }
        } catch (error) {
            console.error('Failed to generate stream key:', error);
        }
    }
    
    async refreshStreams() {
        try {
            const response = await fetch('/api/streams');
            this.activeStreams = await response.json();
            this.updateStreamsList();
            this.updateStats();
        } catch (error) {
            console.error('Failed to refresh streams:', error);
        }
    }
    
    updateStreamsList() {
        const streamsList = document.getElementById('streamsList');
        if (!streamsList) return;
        
        if (this.activeStreams.length === 0) {
            streamsList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-helicopter fa-3x mb-3"></i>
                    <p>현재 활성 DJI 드론 스트림이 없습니다</p>
                    <small>DJI Fly 앱에서 RTMP 스트리밍을 시작하세요</small>
                </div>
            `;
            return;
        }
        
        const streamsHtml = this.activeStreams.map(stream => {
            const startTime = new Date(stream.startTime);
            const duration = this.formatDuration(new Date() - startTime);
            
            return `
                <div class="stream-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-2">
                                <span class="stream-status live">
                                    <i class="fas fa-circle me-1"></i>
                                    LIVE
                                </span>
                                <span class="ms-2">DJI 드론: ${stream.streamKey}</span>
                            </h6>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <small class="text-muted">
                                        <i class="fas fa-clock me-1"></i>
                                        ${duration}
                                    </small>
                                    <small class="text-muted ms-3">
                                        <i class="fas fa-users me-1"></i>
                                        시청자: ${stream.viewers || 0}명
                                    </small>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-primary me-2" onclick="openWatchPage('${stream.streamKey}')">
                                        <i class="fas fa-eye me-1"></i>
                                        시청
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="copyStreamKey('${stream.streamKey}')">
                                        <i class="fas fa-copy me-1"></i>
                                        키 복사
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        streamsList.innerHTML = streamsHtml;
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}시간 ${minutes % 60}분`;
        } else if (minutes > 0) {
            return `${minutes}분 ${seconds % 60}초`;
        } else {
            return `${seconds}초`;
        }
    }
}

// 전역 함수
let streamingManager;

document.addEventListener('DOMContentLoaded', () => {
    streamingManager = new StreamingManager();
});

async function copyToClipboard(elementId) {
    try {
        const element = document.getElementById(elementId);
        const text = element.value || element.textContent;
        
        await navigator.clipboard.writeText(text);
        
        // 성공 알림
        const button = event.target.closest('button');
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
        }, 1000);
        
    } catch (error) {
        console.error('Failed to copy:', error);
        alert('복사에 실패했습니다');
    }
}

function generateStreamKey() {
    streamingManager.generateStreamKey();
}

function refreshStreams() {
    streamingManager.refreshStreams();
}

function watchStream() {
    const streamKey = document.getElementById('playStreamKey').value.trim();
    if (!streamKey) {
        alert('스트림 키를 입력해주세요');
        return;
    }
    openWatchPage(streamKey);
}

function openWatchPage(streamKey) {
    window.open(`/watch?key=${streamKey}`, '_blank');
}

function copyStreamKey(streamKey) {
    navigator.clipboard.writeText(streamKey).then(() => {
        console.log('Stream key copied:', streamKey);
    });
}
```

### 6.2 README.md 업데이트

```bash
# README.md 생성
cat > README.md << 'EOF'
# DJI 드론 실시간 스트리밍 서버

## 🚁 개요
DJI 드론을 위한 전문 실시간 스트리밍 서버입니다.
- DJI RC2, RC Pro, Smart Controller 완벽 지원
- RTMP 스트리밍 서버
- 웹 기반 관리 및 시청 인터페이스
- SSL/HTTPS 지원

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 서버 시작
npm start
```

## 📡 접속 정보
- 관리자: https://your-domain.com:17937
- RTMP: rtmp://your-domain.com:17935/live
- 시청: https://your-domain.com:17937/watch

## 🛠️ DJI 드론 설정
1. DJI Fly 앱에서 전송 → RTMP 선택
2. RTMP URL과 스트림 키 입력
3. RC2는 마이크 연결 필수

EOF
```

---

## 🔧 배포 및 관리

### 7.1 서버 관리 명령어

```bash
# 서버 시작
npm start

# 서버 종료 (모든 포트)
npm run stop

# 또는 수동 종료
lsof -ti:17935,17936,17937,18001,18002 | xargs kill -9
```

### 7.2 자동 재시작 스크립트

```bash
# restart.sh 생성
cat > restart.sh << 'EOF'
#!/bin/bash
echo "🛑 서버 종료 중..."
npm run stop
sleep 2
echo "🚀 서버 시작 중..."
npm start
EOF

chmod +x restart.sh
```

### 7.3 방화벽 설정 (필요시)

```bash
# macOS 방화벽 (필요시)
sudo pfctl -f /etc/pf.conf

# 포트 확인
lsof -i :17935
lsof -i :17936
lsof -i :17937
```

### 7.4 도메인 설정

DNS에서 다음과 같이 설정:
```
A     your-domain.com      → 서버 IP
AAAA  your-domain.com      → 서버 IPv6 (선택사항)
```

---

## 📋 체크리스트

### ✅ 구축 완료 체크리스트

- [ ] Node.js 프로젝트 생성
- [ ] 의존성 설치 완료
- [ ] server.js 구현
- [ ] public/ 디렉토리 및 웹 파일들 생성
- [ ] SSL 인증서 설정 (권장)
- [ ] 방화벽 포트 개방
- [ ] 도메인 DNS 설정
- [ ] 서버 시작 및 테스트
- [ ] DJI 드론 연결 테스트
- [ ] 웹 인터페이스 동작 확인

### 🧪 테스트 방법

1. **서버 시작**: `npm start`
2. **웹 접속**: 브라우저에서 관리자 페이지 확인
3. **DJI 연결**: DJI Fly 앱에서 RTMP 설정
4. **스트리밍 테스트**: 드론으로 실제 스트리밍
5. **시청 테스트**: 웹 플레이어에서 시청 확인

이제 완전한 DJI 드론 전용 실시간 스트리밍 서버가 구축되었습니다! 🎉
