# 🚁 세계 최고 수준의 DJI 드론 실시간 영상 서비스 구축 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [기술 스택 선택](#기술-스택-선택)
4. [인프라 구성](#인프라-구성)
5. [서버 구축 단계별 가이드](#서버-구축-단계별-가이드)
6. [DJI 드론 호환성](#dji-드론-호환성)
7. [고급 최적화](#고급-최적화)
8. [모니터링 및 관리](#모니터링-및-관리)
9. [보안 및 인증](#보안-및-인증)
10. [글로벌 확장](#글로벌-확장)

---

## 🎯 프로젝트 개요

### 목표
- **초저지연 실시간 스트리밍**: 100ms 이하 지연시간
- **4K/8K 고화질 지원**: 최대 60fps
- **글로벌 멀티 CDN**: 전 세계 어디서든 안정적 시청
- **DJI 전기종 지원**: RC2, RC Pro, Smart Controller 등
- **자동 페일오버**: 99.99% 가용성 보장
- **실시간 AI 분석**: 객체 추적, 이상 상황 탐지

### 핵심 기능
- **멀티 프로토콜 지원**: RTMP, WebRTC, HLS, DASH
- **적응형 비트레이트**: 네트워크 상황에 따른 자동 품질 조절
- **실시간 채팅 및 상호작용**: Socket.IO 기반
- **녹화 및 하이라이트**: 자동 클립 생성
- **지도 통합**: 실시간 GPS 위치 표시
- **멀티 뷰어 지원**: 동시 여러 각도 시청

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   DJI 드론      │───▶│  Ingest Server   │───▶│  Origin Server  │
│ (RTMP/WebRTC)   │    │ (Load Balancer)  │    │   (Streaming)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                         ┌──────▼──────┐         ┌──────▼──────┐
                         │  Transcoder │         │ CDN Network │
                         │ (FFmpeg/GPU)│         │ (CloudFlare)│
                         └─────────────┘         └─────────────┘
                                │                        │
                    ┌───────────▼───────────┐    ┌──────▼──────┐
                    │   Analytics Server    │    │   Viewers   │
                    │ (AI/ML Processing)    │    │ (Web/Mobile)│
                    └───────────────────────┘    └─────────────┘
```

### 데이터 플로우
1. **DJI 드론** → RTMP/WebRTC → **인제스트 서버**
2. **인제스트 서버** → **트랜스코딩 서버** (다중 해상도 변환)
3. **트랜스코딩 서버** → **오리진 서버** (HLS/DASH 패키징)
4. **오리진 서버** → **CDN** → **최종 시청자**

---

## 🛠️ 기술 스택 선택

### Backend
- **Node.js 20+**: 메인 서버 엔진
- **TypeScript**: 타입 안전성
- **Express.js**: 웹 프레임워크
- **Socket.IO**: 실시간 통신
- **Redis**: 캐싱 및 세션 관리
- **PostgreSQL**: 메인 데이터베이스
- **MongoDB**: 로그 및 분석 데이터

### 스트리밍 엔진
- **Node Media Server**: RTMP 수신
- **FFmpeg**: 트랜스코딩 및 처리
- **WebRTC**: 초저지연 스트리밍
- **HLS.js**: 브라우저 재생
- **dash.js**: MPEG-DASH 지원

### 프론트엔드
- **Next.js 14**: React 프레임워크
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **Framer Motion**: 애니메이션
- **Three.js**: 3D 맵 시각화

### 인프라
- **Docker**: 컨테이너화
- **Kubernetes**: 오케스트레이션
- **NGINX**: 로드밸런서/프록시
- **CloudFlare**: CDN 및 보안
- **AWS/GCP**: 클라우드 인프라
- **Grafana**: 모니터링

---

## 🌐 인프라 구성

### 서버 구성 (Production)
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
      - "1935:1935"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    
  streaming-server:
    build: .
    replicas: 3
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/streaming
    
  transcoder:
    image: jrottenberg/ffmpeg:4.4-nvidia
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=streaming
      - POSTGRES_PASSWORD=strongpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### CDN 및 Edge 서버
```bash
# 글로벌 엣지 로케이션
- 서울, 도쿄 (아시아-태평양)
- 싱가포르, 뭄바이 (아시아-남부)
- 프랑크푸르트, 런던 (유럽)
- 뉴욕, 캘리포니아 (북미)
- 시드니 (오세아니아)
```

---

## 🚀 서버 구축 단계별 가이드

### Phase 1: 기본 프로젝트 셋업

#### 1.1 프로젝트 초기화
```bash
# 새 프로젝트 생성
mkdir dji-streaming-platform
cd dji-streaming-platform

# 패키지 초기화
npm init -y

# TypeScript 설정
npm install -g typescript
npm install -D @types/node ts-node nodemon
tsc --init
```

#### 1.2 핵심 의존성 설치
```bash
# 서버 의존성
npm install express cors helmet morgan compression
npm install socket.io redis ioredis
npm install pg mongodb mongoose
npm install jsonwebtoken bcryptjs
npm install multer sharp jimp

# 스트리밍 의존성
npm install node-media-server
npm install fluent-ffmpeg
npm install ws simple-peer

# 개발 의존성
npm install -D @types/express @types/cors
npm install -D @types/jsonwebtoken @types/bcryptjs
npm install -D eslint prettier
```

#### 1.3 프로젝트 구조
```
dji-streaming-platform/
├── src/
│   ├── controllers/         # API 컨트롤러
│   ├── middleware/          # Express 미들웨어
│   ├── models/              # 데이터 모델
│   ├── routes/              # API 라우트
│   ├── services/            # 비즈니스 로직
│   ├── streaming/           # 스트리밍 관련
│   ├── utils/               # 유틸리티
│   └── app.ts               # 메인 앱
├── client/                  # 프론트엔드 (Next.js)
├── docker/                  # Docker 설정
├── nginx/                   # NGINX 설정
├── scripts/                 # 배포 스크립트
├── tests/                   # 테스트 코드
└── docs/                    # 문서
```

### Phase 2: 고성능 스트리밍 서버 구현

#### 2.1 메인 서버 (src/app.ts)
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { StreamingServer } from './streaming/StreamingServer';
import { DatabaseManager } from './services/DatabaseManager';
import { RedisManager } from './services/RedisManager';
import { AIAnalytics } from './services/AIAnalytics';

class DJIStreamingPlatform {
  private app: express.Application;
  private server: any;
  private io: SocketServer;
  private streamingServer: StreamingServer;
  
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: { origin: "*" }
    });
    
    this.initializeMiddleware();
    this.initializeServices();
    this.initializeRoutes();
  }
  
  private initializeMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json({ limit: '100mb' }));
  }
  
  private async initializeServices(): Promise<void> {
    // 데이터베이스 연결
    await DatabaseManager.connect();
    await RedisManager.connect();
    
    // 스트리밍 서버 시작
    this.streamingServer = new StreamingServer(this.io);
    await this.streamingServer.start();
    
    // AI 분석 서비스 시작
    const aiAnalytics = new AIAnalytics();
    await aiAnalytics.initialize();
  }
  
  public start(port: number = 3000): void {
    this.server.listen(port, () => {
      console.log(`🚀 DJI Streaming Platform started on port ${port}`);
      console.log(`🎥 RTMP: rtmp://localhost:1935/live`);
      console.log(`🌐 WebRTC: ws://localhost:${port}/webrtc`);
      console.log(`📡 Dashboard: http://localhost:${port}`);
    });
  }
}

export default DJIStreamingPlatform;
```

#### 2.2 고성능 스트리밍 서버 (src/streaming/StreamingServer.ts)
```typescript
import NodeMediaServer from 'node-media-server';
import { Server as SocketServer } from 'socket.io';
import { FFmpegTranscoder } from './FFmpegTranscoder';
import { WebRTCHandler } from './WebRTCHandler';
import { StreamMetrics } from './StreamMetrics';

export class StreamingServer {
  private nms: NodeMediaServer;
  private transcoder: FFmpegTranscoder;
  private webrtc: WebRTCHandler;
  private metrics: StreamMetrics;
  
  constructor(private io: SocketServer) {
    this.initializeRTMPServer();
    this.transcoder = new FFmpegTranscoder();
    this.webrtc = new WebRTCHandler(io);
    this.metrics = new StreamMetrics();
  }
  
  private initializeRTMPServer(): void {
    const config = {
      rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: 8000,
        mediaroot: './media',
        allow_origin: '*'
      },
      https: {
        port: 8443,
        key: './ssl/privatekey.pem',
        cert: './ssl/certificate.pem'
      }
    };
    
    this.nms = new NodeMediaServer(config);
    this.setupRTMPEvents();
  }
  
  private setupRTMPEvents(): void {
    this.nms.on('prePublish', async (id, StreamPath, args) => {
      console.log(`📡 New stream: ${StreamPath}`);
      
      // 스트림 인증 및 검증
      const isAuthorized = await this.validateStream(StreamPath, args);
      if (!isAuthorized) {
        console.log(`❌ Unauthorized stream: ${StreamPath}`);
        return false;
      }
      
      // 트랜스코딩 시작
      await this.transcoder.startTranscoding(StreamPath);
      
      // 메트릭 추적 시작
      this.metrics.startTracking(id, StreamPath);
      
      // 클라이언트에 알림
      this.io.emit('streamStarted', {
        id,
        streamPath: StreamPath,
        timestamp: new Date()
      });
    });
    
    this.nms.on('donePublish', (id, StreamPath) => {
      console.log(`📴 Stream ended: ${StreamPath}`);
      
      // 트랜스코딩 중지
      this.transcoder.stopTranscoding(StreamPath);
      
      // 메트릭 추적 중지
      this.metrics.stopTracking(id);
      
      // 클라이언트에 알림
      this.io.emit('streamEnded', { id, streamPath: StreamPath });
    });
  }
  
  private async validateStream(streamPath: string, args: any): Promise<boolean> {
    // 스트림 키 검증
    const streamKey = streamPath.split('/').pop();
    
    // 데이터베이스에서 유효한 키인지 확인
    // JWT 토큰 검증
    // 사용자 권한 확인
    
    return true; // 구현 필요
  }
  
  public async start(): Promise<void> {
    this.nms.run();
    await this.webrtc.initialize();
    console.log('🎬 Streaming server started');
  }
}
```

### Phase 3: 고급 기능 구현

#### 3.1 GPU 가속 트랜스코딩 (src/streaming/FFmpegTranscoder.ts)
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';

export class FFmpegTranscoder {
  private activeStreams = new Map<string, any>();
  
  async startTranscoding(streamPath: string): Promise<void> {
    const streamKey = streamPath.split('/').pop();
    const inputUrl = `rtmp://localhost:1935${streamPath}`;
    
    // 다중 해상도 트랜스코딩
    const profiles = [
      { name: '4K', width: 3840, height: 2160, bitrate: '15000k' },
      { name: '1080p', width: 1920, height: 1080, bitrate: '6000k' },
      { name: '720p', width: 1280, height: 720, bitrate: '3000k' },
      { name: '480p', width: 854, height: 480, bitrate: '1500k' }
    ];
    
    profiles.forEach(profile => {
      this.createTranscodeStream(inputUrl, streamKey, profile);
    });
  }
  
  private createTranscodeStream(input: string, streamKey: string, profile: any): void {
    const args = [
      '-i', input,
      '-c:v', 'h264_nvenc', // NVIDIA GPU 가속
      '-preset', 'llhq',     // 저지연 고화질
      '-rc', 'cbr',
      '-b:v', profile.bitrate,
      '-maxrate', profile.bitrate,
      '-bufsize', `${parseInt(profile.bitrate) * 2}k`,
      '-vf', `scale=${profile.width}:${profile.height}`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'flv',
      `rtmp://localhost:1935/hls/${streamKey}_${profile.name}`
    ];
    
    const process = spawn('ffmpeg', args);
    this.activeStreams.set(`${streamKey}_${profile.name}`, process);
    
    process.stdout.on('data', (data) => {
      // 트랜스코딩 진행 상황 로깅
    });
    
    process.stderr.on('data', (data) => {
      console.error(`Transcoding error: ${data}`);
    });
  }
  
  stopTranscoding(streamPath: string): void {
    const streamKey = streamPath.split('/').pop();
    
    this.activeStreams.forEach((process, key) => {
      if (key.startsWith(streamKey)) {
        process.kill('SIGTERM');
        this.activeStreams.delete(key);
      }
    });
  }
}
```

#### 3.2 WebRTC 초저지연 스트리밍 (src/streaming/WebRTCHandler.ts)
```typescript
import { Server as SocketServer } from 'socket.io';
import { spawn } from 'child_process';

export class WebRTCHandler {
  private peerConnections = new Map<string, any>();
  
  constructor(private io: SocketServer) {
    this.setupSocketEvents();
  }
  
  private setupSocketEvents(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 WebRTC client connected: ${socket.id}`);
      
      socket.on('webrtc-offer', async (data) => {
        const { offer, streamKey } = data;
        const answer = await this.handleOffer(offer, streamKey);
        socket.emit('webrtc-answer', { answer });
      });
      
      socket.on('webrtc-ice-candidate', (data) => {
        const { candidate, streamKey } = data;
        this.handleIceCandidate(candidate, streamKey);
      });
      
      socket.on('disconnect', () => {
        this.cleanupPeerConnection(socket.id);
      });
    });
  }
  
  private async handleOffer(offer: any, streamKey: string): Promise<any> {
    // WebRTC Peer Connection 생성 및 처리
    // WHIP (WebRTC-HTTP Ingestion Protocol) 구현
    
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
      ]
    });
    
    this.peerConnections.set(streamKey, peerConnection);
    
    // 미디어 스트림 처리
    await this.setupMediaStreams(peerConnection, streamKey);
    
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    return answer;
  }
  
  private async setupMediaStreams(pc: RTCPeerConnection, streamKey: string): Promise<void> {
    // FFmpeg를 통한 WebRTC 스트림 처리
    const args = [
      '-protocol_whitelist', 'file,udp,rtp',
      '-i', `rtp://localhost:5004`, // RTP 스트림 수신
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-f', 'rtp',
      `rtp://localhost:5006` // WebRTC로 전송
    ];
    
    const ffmpeg = spawn('ffmpeg', args);
    // WebRTC 데이터 채널 처리 로직 추가
  }
  
  public async initialize(): Promise<void> {
    console.log('🚀 WebRTC Handler initialized');
  }
}
```
