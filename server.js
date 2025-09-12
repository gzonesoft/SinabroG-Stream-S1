const express = require('express');
const NodeMediaServer = require('node-media-server');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const PositionLogger = require('./position-logger');

const app = express();

// 위치정보 로거 초기화
const positionLogger = new PositionLogger();

// SSL 인증서 설정
const sslOptions = {
  key: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.key'),
  cert: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.crt'),
  passphrase: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/password.txt', 'utf8').trim()
};

// HTTP와 HTTPS 서버 생성
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// Socket.IO를 두 서버 모두에 연결
const io = socketIo(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// HTTP 서버에도 Socket.IO 연결
io.attach(httpServer);

// 미들웨어 설정
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

// 업로드 크기 제한 증가 (50MB까지 허용)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// favicon.ico 처리 (404 오류 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content로 응답 (빈 응답)
});

// 추가 CORS 헤더 설정
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
const config = {
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
  },
  https: {
    port: 18002,
    key: '/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.key',
    cert: '/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.crt',
    passphrase: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/password.txt', 'utf8').trim()
  }
};

const nms = new NodeMediaServer(config);

// 활성 스트림 추적
let activeStreams = new Map();
let streamStats = new Map();

// NodeMediaServer 내부 스트림 세션 접근
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

// 스트림 매핑을 위한 커스텀 로직
nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  let streamKey;
  if (StreamPath === '/live/' || StreamPath === '/live') {
    streamKey = 'live';
  } else if (StreamPath.startsWith('/live/')) {
    streamKey = StreamPath.substring(6);
  } else {
    streamKey = StreamPath.substring(1);
  }
  
  if (!streamKey || streamKey === '') {
    streamKey = 'live';
  }
  
  console.log(`[INFO] Stream mapping: ${StreamPath} -> /live/${streamKey} (key: ${streamKey})`);
  
  // 스트림 정보 저장
  activeStreams.set(id, {
    streamPath: `/live/${streamKey}`,
    originalPath: StreamPath,
    streamKey: streamKey,
    startTime: new Date(),
    viewers: 0,
    publisherId: id
  });
  
  io.emit('streamStarted', {
    id: id,
    streamPath: `/live/${streamKey}`,
    originalPath: StreamPath,
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
  
  let foundStream = null;
  let matchedStreamId = null;
  
  // 1. 정확한 경로 매칭
  for (const [streamId, streamInfo] of activeStreams) {
    if (streamInfo.streamPath === StreamPath) {
      foundStream = streamInfo;
      matchedStreamId = streamId;
      console.log(`[INFO] Exact path match: ${StreamPath}`);
      break;
    }
  }
  
  // 2. 스트림 키 기반 매칭
  if (!foundStream) {
    const requestedKey = StreamPath.split('/').pop().replace('.flv', '').replace('.m3u8', '');
    for (const [streamId, streamInfo] of activeStreams) {
      if (streamInfo.streamKey === requestedKey) {
        foundStream = streamInfo;
        matchedStreamId = streamId;
        console.log(`[INFO] Stream key match: ${requestedKey} -> ${streamInfo.streamPath}`);
        break;
      }
    }
  }
  
  // 3. 원본 경로 매칭 (fallback)
  if (!foundStream) {
    for (const [streamId, streamInfo] of activeStreams) {
      if (streamInfo.originalPath === StreamPath) {
        foundStream = streamInfo;
        matchedStreamId = streamId;
        console.log(`[INFO] Original path match: ${StreamPath}`);
        break;
      }
    }
  }
  
  if (foundStream) {
    foundStream.viewers = (foundStream.viewers || 0) + 1;
    console.log(`[INFO] Viewer joined stream: ${foundStream.streamKey} (viewers: ${foundStream.viewers})`);
  } else {
    console.log(`[WARN] Stream not found for path: ${StreamPath}`);
    console.log(`[DEBUG] Available streams:`, Array.from(activeStreams.values()).map(s => ({
      key: s.streamKey,
      path: s.streamPath,
      original: s.originalPath
    })));
    
    // 기본 스트림이 있다면 리다이렉트 시도
    if (activeStreams.size > 0) {
      const defaultStream = Array.from(activeStreams.values())[0];
      console.log(`[INFO] Attempting redirect to: ${defaultStream.streamPath}`);
    }
  }
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  
  // 시청자 수 감소
  if (activeStreams.has(id)) {
    const stream = activeStreams.get(id);
    stream.viewers = Math.max(0, stream.viewers - 1);
    activeStreams.set(id, stream);
  }
});
// API 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 시청자용 페이지
app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

// 간단한 시청 페이지
app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple.html'));
});

// 카메라 갤러리 페이지
app.get('/camera', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'camera.html'));
});

// 스트림 테스트 페이지
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
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

// 데이터 오버레이 API
app.get('/api/overlay-data', (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data_overly.json');
    
    // 파일 존재 확인
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ 
        error: 'Data overlay file not found',
        path: dataPath 
      });
    }
    
    // 파일 읽기
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const overlayData = JSON.parse(rawData);
    
    // 타임스탬프 추가 (클라이언트에서 변경사항 감지용)
    const stats = fs.statSync(dataPath);
    overlayData._lastModified = stats.mtime.toISOString();
    overlayData._timestamp = new Date().toISOString();
    
    res.json(overlayData);
  } catch (error) {
    console.error('Error reading overlay data:', error);
    res.status(500).json({ 
      error: 'Failed to read overlay data',
      message: error.message 
    });
  }
});

// 데이터 오버레이 POST API - 외부 앱에서 위치 데이터 업데이트
app.post('/api/overlay-data', (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data_overly.json');
    
    // 요청 본문에서 데이터 추출
    const overlayData = req.body;
    
    // 디버깅용 로그
    console.log(`[${new Date().toLocaleTimeString()}] POST /api/overlay-data 요청 수신:`);
    console.log(`  클라이언트 IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`  User-Agent: ${req.headers['user-agent']}`);
    console.log(`  Protocol: ${req.protocol}`);
    console.log(`  Secure: ${req.secure}`);
    
    // 유효성 검사
    if (!overlayData || typeof overlayData !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid data format',
        message: 'Request body must be a valid JSON object'
      });
    }
    
    // 기존 데이터 읽기 (없으면 빈 객체)
    let existingData = {};
    if (fs.existsSync(dataPath)) {
      try {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        existingData = JSON.parse(rawData);
      } catch (err) {
        console.error('Error reading existing overlay data:', err);
      }
    }
    
    // 데이터 병합 (받은 데이터로 업데이트)
    const updatedData = {
      ...existingData,
      ...overlayData,
      _lastUpdated: new Date().toISOString()
    };
    
    // TIME 필드가 없으면 현재 시간 추가
    if (!updatedData.TIME) {
      updatedData.TIME = new Date().toISOString();
    }
    
    // 파일에 저장
    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 4));
    
    // 위치정보 로그 저장 (무조건 기록)
    positionLogger.logPositionData(updatedData);
    
    console.log(`[${new Date().toLocaleTimeString()}] 오버레이 데이터 업데이트 (POST):`);
    console.log(`  받은 데이터:`, overlayData);
    
    // Socket.IO로 실시간 브로드캐스트
    io.emit('overlayDataUpdated', updatedData);
    
    res.json({
      success: true,
      message: 'Overlay data updated successfully',
      data: updatedData
    });
    
  } catch (error) {
    console.error('Error updating overlay data:', error);
    res.status(500).json({ 
      error: 'Failed to update overlay data',
      message: error.message 
    });
  }
});

// 캡처 이미지 저장 API
app.post('/api/capture/save', (req, res) => {
  try {
    const { imageData, metadata } = req.body;
    
    // 유효성 검사
    if (!imageData || !imageData.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    
    // 이미지 타입 감지 및 확장자 결정
    let fileExtension = '.png';
    let base64Prefix = 'data:image/png;base64,';
    
    if (imageData.startsWith('data:image/jpeg')) {
      fileExtension = '.jpg';
      base64Prefix = 'data:image/jpeg;base64,';
    } else if (imageData.startsWith('data:image/png')) {
      fileExtension = '.png';
      base64Prefix = 'data:image/png;base64,';
    }
    
    // 파일명 생성
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const streamKey = metadata.streamKey || 'unknown';
    const filename = `capture_${streamKey}_${timestamp}${fileExtension}`;
    const filepath = path.join('/Users/gzonesoft/api_files/stream/capture', filename);
    
    // 디렉토리가 존재하지 않으면 생성
    const captureDir = path.dirname(filepath);
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
      console.log(`📁 캡처 저장 디렉토리 생성: ${captureDir}`);
    }
    
    // Base64 데이터에서 이미지 데이터 추출
    const base64Data = imageData.replace(base64Prefix, '');
    
    // 파일 저장
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    // 메타데이터 파일 저장
    const metadataFilename = filename.replace(fileExtension, '_metadata.json');
    const metadataFilepath = path.join('/Users/gzonesoft/api_files/stream/capture', metadataFilename);
    
    const fullMetadata = {
      ...metadata,
      filename: filename,
      filepath: filepath,
      savedAt: new Date().toISOString(),
      fileSize: fs.statSync(filepath).size
    };
    
    fs.writeFileSync(metadataFilepath, JSON.stringify(fullMetadata, null, 2));
    
    // 성공 응답
    res.json({
      success: true,
      filename: filename,
      filepath: filepath,
      metadata: fullMetadata,
      savedAt: new Date().toISOString()
    });
    
    console.log(`✅ 캡처 이미지 저장 완료: ${filename}`);
    
  } catch (error) {
    console.error('❌ 캡처 이미지 저장 실패:', error);
    res.status(500).json({ 
      error: 'Failed to save capture image',
      message: error.message 
    });
  }
});

// 저장된 캡처 목록 조회 API
app.get('/api/capture/list', (req, res) => {
  try {
    const captureDir = '/Users/gzonesoft/api_files/stream/capture';
    
    // 디렉토리 존재 확인
    if (!fs.existsSync(captureDir)) {
      return res.json({ captures: [] });
    }
    
    // PNG 파일들만 조회
    const files = fs.readdirSync(captureDir).filter(file => file.endsWith('.png'));
    
    const captures = files.map(filename => {
      const filepath = path.join(captureDir, filename);
      const metadataFilename = filename.replace('.png', '_metadata.json');
      const metadataFilepath = path.join(captureDir, metadataFilename);
      
      const stats = fs.statSync(filepath);
      let metadata = {};
      
      // 메타데이터 파일이 있으면 읽기
      if (fs.existsSync(metadataFilepath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataFilepath, 'utf8'));
        } catch (e) {
          console.warn('메타데이터 파일 읽기 실패:', metadataFilename);
        }
      }
      
      return {
        filename: filename,
        filepath: filepath,
        fileSize: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        metadata: metadata
      };
    });
    
    // 생성 시간 기준 역순 정렬 (최신 먼저)
    captures.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ captures });
    
  } catch (error) {
    console.error('❌ 캡처 목록 조회 실패:', error);
    res.status(500).json({ 
      error: 'Failed to list captures',
      message: error.message 
    });
  }
});

// 특정 캡처 이미지 다운로드 API
app.get('/api/capture/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join('/Users/gzonesoft/api_files/stream/capture', filename);
    
    // 파일 존재 확인
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // 위치 정보 기반 파일명 생성
    let downloadFilename = filename;
    
    try {
      // 메타데이터 파일에서 캡처 시점의 정보 읽기
      const metadataFilename = filename.replace(path.extname(filename), '_metadata.json');
      const metadataFilepath = path.join('/Users/gzonesoft/api_files/stream/capture', metadataFilename);
      
      let overlayData = null;
      let captureTimestamp = null;
      
      // 메타데이터 파일이 있으면 캡처 시점의 정보 사용
      if (fs.existsSync(metadataFilepath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataFilepath, 'utf8'));
        overlayData = metadata.overlayData?.userScreenData?.sensorData;
        captureTimestamp = metadata.timestamp || metadata.savedAt;
      }
      
      // 메타데이터가 없으면 현재 data_overly.json 사용
      if (!overlayData) {
        const overlayDataPath = path.join(__dirname, 'data_overly.json');
        if (fs.existsSync(overlayDataPath)) {
          overlayData = JSON.parse(fs.readFileSync(overlayDataPath, 'utf8'));
          captureTimestamp = overlayData.TIME || new Date().toISOString();
        }
      }
      
      if (overlayData && overlayData.LATITUDE && overlayData.LONGITUDE) {
        // 캡처 시점의 시간 사용 (한국 시간으로 변환)
        const timestamp = new Date(captureTimestamp);
        
        // 한국 시간(KST)으로 변환
        const kstDate = new Date(timestamp.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const year = kstDate.getUTCFullYear();
        const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getUTCDate()).padStart(2, '0');
        const hour = String(kstDate.getUTCHours()).padStart(2, '0');
        const minute = String(kstDate.getUTCMinutes()).padStart(2, '0');
        const second = String(kstDate.getUTCSeconds()).padStart(2, '0');
        
        // 날짜 문자열 생성 (YYYYMMDDHHMMSS 형식)
        const dateStr = `${year}${month}${day}${hour}${minute}${second}`;
        
        // 위도, 경도, 고도 정보
        const latitude = overlayData.LATITUDE || 0;
        const longitude = overlayData.LONGITUDE || 0;
        const altitude = Math.round(overlayData.ALTITUDE || 0);
        
        // 위도/경도를 정수로 변환 (소수점 6자리까지 유지하면서 점 제거)
        const latitudeStr = (latitude * 1000000).toFixed(0);
        const longitudeStr = (longitude * 1000000).toFixed(0);
        
        // 파일 확장자 추출
        const fileExt = path.extname(filename);
        
        // 새로운 파일명 생성: 날짜_위도_경도_고도.확장자
        downloadFilename = `${dateStr}_${latitudeStr}_${longitudeStr}_${altitude}${fileExt}`;
        
        console.log(`📁 파일명 변경: ${filename} -> ${downloadFilename}`);
        console.log(`📍 위치 정보: 위도=${latitude}, 경도=${longitude}, 고도=${altitude}m`);
        console.log(`⏰ 캡처 시간: ${captureTimestamp} -> KST: ${dateStr}`);
      }
    } catch (locationError) {
      console.warn('⚠️ 위치 정보 읽기 실패, 원본 파일명 사용:', locationError.message);
    }
    
    // 파일 다운로드 (새로운 파일명으로)
    res.download(filepath, downloadFilename);
    
  } catch (error) {
    console.error('❌ 캡처 파일 다운로드 실패:', error);
    res.status(500).json({ 
      error: 'Failed to download capture',
      message: error.message 
    });
  }
});

// 특정 캡처 이미지 삭제 API
app.delete('/api/capture/delete/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join('/Users/gzonesoft/api_files/stream/capture', filename);
    const metadataFilename = filename.replace('.png', '_metadata.json');
    const metadataFilepath = path.join('/Users/gzonesoft/api_files/stream/capture', metadataFilename);
    
    // 이미지 파일 삭제
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    // 메타데이터 파일 삭제
    if (fs.existsSync(metadataFilepath)) {
      fs.unlinkSync(metadataFilepath);
    }
    
    res.json({ 
      success: true,
      message: `File ${filename} deleted successfully`
    });
    
    console.log(`🗑️ 캡처 이미지 삭제 완료: ${filename}`);
    
  } catch (error) {
    console.error('❌ 캡처 파일 삭제 실패:', error);
    res.status(500).json({ 
      error: 'Failed to delete capture',
      message: error.message 
    });
  }
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

// 서버 시작
const HTTP_PORT = process.env.HTTP_PORT || 17936;
const HTTPS_PORT = process.env.HTTPS_PORT || 17937;

// HTTP 서버 (API 지원 포함)
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on port ${HTTP_PORT} (API endpoints available)`);
});

// HTTPS 서버 (메인)
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running on port ${HTTPS_PORT}`);
  console.log(`RTMP server running on port 17935`);
  console.log(`HTTP-FLV server running on port 18001`);
  console.log(`HTTPS-FLV server running on port 18002`);
});

// HTTP → HTTPS 리다이렉트 미들웨어 (API 경로는 제외)
app.use((req, res, next) => {
  // API 경로는 HTTP/HTTPS 모두 허용
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // API가 아닌 경로만 HTTPS로 리다이렉트
  if (req.header('x-forwarded-proto') !== 'https' && req.secure === false) {
    return res.redirect(301, `https://${req.header('host').replace(':17936', ':17937')}${req.url}`);
  }
  next();
});

nms.run();

console.log('RTMP Streaming Service Started!');
console.log('==========================================');
console.log('RTMP URL: rtmp://ai.gzonesoft.com:17935/live');
console.log('HTTP Interface: http://ai.gzonesoft.com:17936');
console.log('  - API endpoints: http://ai.gzonesoft.com:17936/api/*');
console.log('HTTPS Interface: https://ai.gzonesoft.com:17937');
console.log('HTTPS-FLV Stream: https://ai.gzonesoft.com:18002/live/[key].flv');
console.log('==========================================');
console.log('NOTE: API endpoints are available on both HTTP and HTTPS');
