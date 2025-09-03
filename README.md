# RTMP 스트리밍 서비스

Node.js와 Express를 사용하여 구축된 RTMP 스트리밍 서비스입니다. 실시간 스트림 모니터링, 웹 기반 관리 인터페이스, 그리고 HLS/FLV 재생 기능을 제공합니다.

## 주요 기능

- **RTMP 스트리밍 서버**: OBS, XSplit 등의 스트리밍 소프트웨어 지원
- **실시간 웹 대시보드**: 활성 스트림 모니터링 및 관리
- **스트림 키 관리**: 자동 스트림 키 생성 및 복사 기능
- **웹 플레이어**: HLS/FLV 형식으로 스트림 재생
- **실시간 알림**: Socket.IO를 통한 실시간 상태 업데이트
- **반응형 디자인**: 모바일 및 데스크톱 지원

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 서버 실행

```bash
# 프로덕션 모드
npm start

# 개발 모드 (nodemon)
npm run dev
```

### 3. 접속

- **웹 인터페이스**: http://localhost:17936
- **RTMP 서버**: rtmp://localhost:17935/live
- **HLS/FLV 서버**: http://localhost:18000

## 사용 방법

### 스트리밍 설정 (OBS)

1. OBS Studio를 열고 '설정' > '방송'으로 이동
2. 서비스: 사용자 정의
3. 서버: `rtmp://localhost:17935/live`
4. 스트림 키: 웹 인터페이스에서 생성된 키 사용

### 웹 인터페이스 사용

1. 웹 브라우저에서 http://localhost:17936 접속
2. '키 생성' 버튼으로 새 스트림 키 생성
3. 생성된 RTMP URL과 스트림 키를 OBS에 설정
4. 스트리밍 시작 후 웹 인터페이스에서 모니터링

### 스트림 시청

1. 웹 인터페이스의 '스트림 플레이어'에서 스트림 키 입력
2. '재생' 버튼 클릭
3. 또는 활성 스트림 목록에서 '시청' 버튼 클릭

## 기술 스택

- **백엔드**: Node.js, Express.js
- **스트리밍**: node-media-server
- **실시간 통신**: Socket.IO
- **프론트엔드**: HTML5, Bootstrap 5, JavaScript
- **비디오 재생**: HLS.js

## API 엔드포인트

### GET /api/streams
활성 스트림 목록을 반환합니다.

```json
[
  {
    "id": "stream_id",
    "streamPath": "/live/stream_key",
    "streamKey": "generated_key",
    "startTime": "2024-01-01T00:00:00.000Z",
    "viewers": 5
  }
]
```

### POST /api/generate-key
새로운 스트림 키를 생성합니다.

```json
{
  "streamKey": "abc123def456"
}
```

### GET /api/streams/:id
특정 스트림의 상세 정보를 반환합니다.

## Socket.IO 이벤트

- `streamStarted`: 새 스트림 시작 시 발생
- `streamEnded`: 스트림 종료 시 발생
- `activeStreams`: 현재 활성 스트림 목록

## 설정

### 포트 변경

환경 변수나 코드에서 다음 포트들을 변경할 수 있습니다:

- 웹 서버: `PORT` 환경변수 또는 기본값 17936
- RTMP 서버: 기본값 17935
- HTTP-FLV 서버: 기본값 18000

### RTMP 서버 설정

`server.js`의 `config` 객체에서 RTMP 서버 설정을 변경할 수 있습니다:

```javascript
const config = {
  rtmp: {
    port: 17935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 18000,
    allow_origin: '*'
  }
};
```

## 문제 해결

### 스트림이 재생되지 않을 때

1. 방화벽에서 포트 17935, 17936, 18000이 열려있는지 확인
2. 브라우저가 HLS를 지원하는지 확인
3. VLC 등 외부 플레이어로 FLV URL 테스트

### OBS 연결 문제

1. RTMP URL이 정확한지 확인: `rtmp://localhost:17935/live`
2. 스트림 키가 올바르게 입력되었는지 확인
3. 네트워크 연결 상태 확인

## 라이선스

MIT License

## 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing-feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
