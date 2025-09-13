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
const CaptureFileHelper = require('./capture-api-helper');

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

// 위치정보 이력 조회 API (Supabase 대체)
app.post('/api/position-history/query', async (req, res) => {
  try {
    const { device_id, start_date, end_date, limit = 100 } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '디바이스 ID가 필요합니다.' });
    }
    
    // Docker 명령어 구성
    const startDateStr = start_date || new Date(Date.now() - 24*60*60*1000).toISOString();
    const endDateStr = end_date || new Date().toISOString();
    
    const dockerCmd = `docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM ah_get_position_history(
          '${device_id}',
          '${startDateStr}'::timestamptz,
          '${endDateStr}'::timestamptz,
          ${limit}
        )
      ) t;
    "`;
    
    const { exec } = require('child_process');
    exec(dockerCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Docker 실행 오류:', error);
        return res.status(500).json({ error: '데이터베이스 조회 실패', details: stderr });
      }
      
      try {
        const result = JSON.parse(stdout.trim() || '[]');
        res.json(result || []);
      } catch (parseError) {
        console.error('파싱 오류:', parseError);
        res.json([]);
      }
    });
    
  } catch (error) {
    console.error('위치 이력 조회 실패:', error);
    res.status(500).json({ error: '조회 실패', message: error.message });
  }
});

// 현재 위치 조회 API
app.post('/api/position-history/current', async (req, res) => {
  try {
    const { device_id } = req.body;
    
    const deviceFilter = device_id ? `'${device_id}'` : 'NULL';
    
    const dockerCmd = `docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM ah_get_current_position(${deviceFilter})
      ) t;
    "`;
    
    const { exec } = require('child_process');
    exec(dockerCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Docker 실행 오류:', error);
        return res.status(500).json({ error: '데이터베이스 조회 실패', details: stderr });
      }
      
      try {
        const result = JSON.parse(stdout.trim() || '[]');
        res.json(result || []);
      } catch (parseError) {
        console.error('파싱 오류:', parseError);
        res.json([]);
      }
    });
    
  } catch (error) {
    console.error('현재 위치 조회 실패:', error);
    res.status(500).json({ error: '조회 실패', message: error.message });
  }
});

// 위치 통계 조회 API
app.post('/api/position-history/stats', async (req, res) => {
  try {
    const { device_id, period_days = 7 } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: '디바이스 ID가 필요합니다.' });
    }
    
    const dockerCmd = `docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "
      SELECT row_to_json(ah_get_position_stats('${device_id}', ${period_days}));
    "`;
    
    const { exec } = require('child_process');
    exec(dockerCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Docker 실행 오류:', error);
        return res.status(500).json({ error: '데이터베이스 조회 실패', details: stderr });
      }
      
      try {
        const result = JSON.parse(stdout.trim() || '{}');
        res.json(result);
      } catch (parseError) {
        console.error('파싱 오류:', parseError);
        res.json({});
      }
    });
    
  } catch (error) {
    console.error('통계 조회 실패:', error);
    res.status(500).json({ error: '조회 실패', message: error.message });
  }
});

// 위치 이력 저장 API (JWT 인증 우회용)
app.post('/api/position-history', async (req, res) => {
    try {
        const {
            device_id = 'DJI_DEVICE_001',
            latitude,
            longitude,
            altitude = 0,
            speed = 0,
            heading = 0,
            battery_level = null,
            timestamp = null,
            metadata = {}
        } = req.body;

        // 필수 필드 검증
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: '위도와 경도는 필수입니다.'
            });
        }

        // Docker PostgreSQL 직접 접근
        const { spawn } = require('child_process');
        
        const query = `SELECT ah_save_position_history('${device_id}', ${latitude}, ${longitude}, ${altitude}, ${speed}, ${heading}, ${battery_level || 'NULL'}, ${timestamp ? `'${timestamp}'` : 'NOW()'});`;
        
        console.log('📍 위치 이력 저장 쿼리:', query);
        
        const docker = spawn('docker', ['exec', '-i', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', query]);
        
        let output = '';
        let error = '';
        
        docker.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        docker.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        docker.on('close', (code) => {
            if (code === 0 && output.includes('success')) {
                try {
                    // JSON 응답 파싱
                    const jsonMatch = output.match(/\{.*\}/s);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        console.log('✅ 위치 이력 저장 성공:', result);
                        res.json(result);
                    } else {
                        res.json({ success: true, message: '위치 데이터가 저장되었습니다.' });
                    }
                } catch (parseError) {
                    res.json({ success: true, message: '위치 데이터가 저장되었습니다.', raw_output: output });
                }
            } else {
                console.error('❌ PostgreSQL 오류:', error);
                res.status(500).json({
                    success: false,
                    error: `데이터베이스 오류: ${error}`,
                    output: output
                });
            }
        });

    } catch (error) {
        console.error('❌ 위치 이력 저장 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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
    
    // 위치 데이터 API 전송을 위한 이벤트 발송
    io.emit('positionDataUpdate', updatedData);
    
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
    
    // 현재 날짜로 년/월/일 폴더 경로 생성
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // 파일명 생성
    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const streamKey = metadata.streamKey || 'unknown';
    const filename = `capture_${streamKey}_${timestamp}${fileExtension}`;
    
    // 년/월/일 구조로 저장 경로 생성
    const captureDir = path.join('/Users/gzonesoft/api_files/stream/capture', year.toString(), month, day);
    const filepath = path.join(captureDir, filename);
    
    // 디렉토리가 존재하지 않으면 생성
    if (!fs.existsSync(captureDir)) {
      fs.mkdirSync(captureDir, { recursive: true });
      console.log(`📁 캡처 저장 디렉토리 생성: ${captureDir}`);
    }
    
    // Base64 데이터에서 이미지 데이터 추출
    const base64Data = imageData.replace(base64Prefix, '');
    
    // 파일 저장
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    // 메타데이터 파일 저장 (같은 년/월/일 폴더에)
    const metadataFilename = filename.replace(fileExtension, '_metadata.json');
    const metadataFilepath = path.join(captureDir, metadataFilename);
    
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
    const helper = new CaptureFileHelper();
    const captures = helper.getCaptureList();
    
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
app.get('/api/capture/download/*', (req, res) => {
  try {
    const requestPath = req.params[0];
    const helper = new CaptureFileHelper();
    const filepath = helper.findFile(requestPath);
    const filename = path.basename(requestPath);
    
    // 파일 존재 확인
    if (!filepath) {
      return res.status(404).json({ error: 'File not found', requested: requestPath });
    }
    
    // 위치 정보 기반 파일명 생성
    let downloadFilename = filename;
    
    try {
      // 메타데이터 파일에서 캡처 시점의 정보 읽기
      // filepath에서 메타데이터 경로 생성 (같은 디렉토리에 있음)
      const metadataFilepath = filepath.replace(path.extname(filepath), '_metadata.json');
      console.log('메타데이터 파일 경로:', metadataFilepath);
      
      let overlayData = null;
      let captureTimestamp = null;
      
      // 메타데이터 파일이 있으면 캡처 시점의 정보 사용
      if (fs.existsSync(metadataFilepath)) {
        console.log('✅ 메타데이터 파일 발견!');
        const metadata = JSON.parse(fs.readFileSync(metadataFilepath, 'utf8'));
        const sensorData = metadata.overlayData?.userScreenData?.sensorData;
        
        console.log('센서 데이터:', JSON.stringify(sensorData, null, 2));
        
        // 센서 데이터가 문자열 형식인 경우 변환
        if (sensorData) {
          overlayData = {
            LATITUDE: typeof sensorData.LATITUDE === 'string' ? parseFloat(sensorData.LATITUDE) : sensorData.LATITUDE,
            LONGITUDE: typeof sensorData.LONGITUDE === 'string' ? parseFloat(sensorData.LONGITUDE) : sensorData.LONGITUDE,
            ALTITUDE: typeof sensorData.ALTITUDE === 'string' ? parseFloat(sensorData.ALTITUDE.replace(/[^\d.-]/g, '')) : sensorData.ALTITUDE,
            TIME: sensorData.TIME
          };
          console.log('변환된 데이터:');
          console.log('  위도:', overlayData.LATITUDE);
          console.log('  경도:', overlayData.LONGITUDE);
          console.log('  고도 원본:', sensorData.ALTITUDE);
          console.log('  고도 변환:', overlayData.ALTITUDE);
        } else {
          console.log('⚠️ 센서 데이터가 없음');
          overlayData = null;
        }
        
        captureTimestamp = metadata.timestamp || metadata.savedAt;
      } else {
        console.log('❌ 메타데이터 파일 없음:', metadataFilepath);
      }
      
      // 메타데이터가 없으면 현재 data_overly.json 사용
      if (!overlayData) {
        const overlayDataPath = path.join(__dirname, 'data_overly.json');
        if (fs.existsSync(overlayDataPath)) {
          overlayData = JSON.parse(fs.readFileSync(overlayDataPath, 'utf8'));
          captureTimestamp = overlayData.TIME || new Date().toISOString();
        }
      }
      
      // 로그 파일에 다운로드 요청 기록
      const logEntry = {
        requestTime: new Date().toISOString(),
        requestedFile: filename,
        metadataPath: metadataFilepath,
        metadataExists: fs.existsSync(metadataFilepath),
        captureTimestamp: captureTimestamp,
        overlayData: overlayData ? {
          LATITUDE: overlayData.LATITUDE,
          LONGITUDE: overlayData.LONGITUDE,
          ALTITUDE: overlayData.ALTITUDE,
          TIME: overlayData.TIME
        } : null
      };
      
      console.log('\n========== 다운로드 요청 디버깅 ==========');
      console.log('요청 파일:', filename);
      console.log('메타데이터 경로:', metadataFilepath);
      console.log('메타데이터 존재:', fs.existsSync(metadataFilepath));
      console.log('캡처 타임스탬프:', captureTimestamp);
      console.log('오버레이 데이터:', logEntry.overlayData);
      
      if (overlayData && overlayData.LATITUDE && overlayData.LONGITUDE) {
        // 캡처 시점의 시간 사용 - 다양한 형식 처리
        let timestamp;
        let dateStr = '';
        
        try {
          // captureTimestamp가 유효한지 확인
          if (!captureTimestamp || captureTimestamp === 'undefined') {
            console.warn('⚠️ captureTimestamp가 없음, 현재 시간 사용');
            captureTimestamp = new Date().toISOString();
          }
          
          // Java/Android 형식의 타임스탬프 처리 (타임존 정보 제거)
          // 예: "2025-09-13T11:20:08.108+09:00[Asia/Seoul]" -> "2025-09-13T11:20:08.108+09:00"
          if (typeof captureTimestamp === 'string' && captureTimestamp.includes('[')) {
            captureTimestamp = captureTimestamp.split('[')[0];
            console.log('타임존 정보 제거:', captureTimestamp);
          }
          
          timestamp = new Date(captureTimestamp);
          
          // 날짜가 유효한지 확인
          if (isNaN(timestamp.getTime())) {
            console.warn('⚠️ 유효하지 않은 타임스탬프:', captureTimestamp);
            // ISO 8601 형식으로 다시 시도
            if (typeof captureTimestamp === 'string') {
              // +09:00 형식을 제거하고 Z로 변환 시도
              const cleanTimestamp = captureTimestamp.replace(/[+-]\d{2}:\d{2}$/, 'Z');
              timestamp = new Date(cleanTimestamp);
              
              if (isNaN(timestamp.getTime())) {
                console.warn('⚠️ 여전히 유효하지 않음, 현재 시간 사용');
                timestamp = new Date();
              }
            } else {
              timestamp = new Date();
            }
          }
          
          // 한국 시간(KST) 처리
          // timestamp는 이미 정확한 시간을 가지고 있음 (타임존 정보 포함)
          // 로컬 시간으로 직접 사용
          const year = timestamp.getFullYear();
          const month = String(timestamp.getMonth() + 1).padStart(2, '0');
          const day = String(timestamp.getDate()).padStart(2, '0');
          const hour = String(timestamp.getHours()).padStart(2, '0');
          const minute = String(timestamp.getMinutes()).padStart(2, '0');
          const second = String(timestamp.getSeconds()).padStart(2, '0');
          
          // 날짜 문자열 생성 (YYYYMMDDHHMMSS 형식)
          dateStr = `${year}${month}${day}${hour}${minute}${second}`;
          
          console.log('날짜 변환 성공:', dateStr);
        } catch (dateError) {
          console.error('❌ 날짜 변환 실패:', dateError);
          // 오류 시 현재 날짜 사용
          const now = new Date();
          const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
          dateStr = kstNow.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
          console.log('기본 날짜 사용:', dateStr);
        }
        
        // 위도, 경도, 고도 정보
        const latitude = overlayData.LATITUDE || 0;
        const longitude = overlayData.LONGITUDE || 0;
        // 고도 처리 - 소수점 1자리까지 유지하고 음수는 0으로
        const rawAltitude = overlayData.ALTITUDE || 0;
        const altitude = Math.max(0, rawAltitude);
        // 고도를 소수점 1자리로 포맷하고 점을 #으로 대체
        const altitudeStr = altitude.toFixed(1).replace('.', '#');
        
        // 위도/경도를 문자열로 변환하고 소수점을 #으로 대체
        const latitudeStr = latitude.toString().replace('.', '#');
        const longitudeStr = longitude.toString().replace('.', '#');
        
        // 파일 확장자 추출
        const fileExt = path.extname(filename);
        
        // 새로운 파일명 생성: 날짜_위도_경도_고도.확장자
        downloadFilename = `${dateStr}_${latitudeStr}_${longitudeStr}_${altitudeStr}${fileExt}`;
        
        console.log(`📁 파일명 변경: ${filename} -> ${downloadFilename}`);
        console.log(`📍 위치 정보: 위도=${latitude}, 경도=${longitude}, 고도=${rawAltitude}m (표시: ${altitudeStr}m)`);
        console.log(`⏰ 캡처 시간: ${captureTimestamp} -> KST: ${dateStr}`);
        console.log('========================================\n');
        
        // 다운로드 로그 파일에 기록
        const downloadLog = `${new Date().toISOString()} | 요청: ${filename} | 생성: ${downloadFilename} | 위치: ${latitude},${longitude},${rawAltitude} (표시: ${altitudeStr})\n`;
        fs.appendFileSync(path.join(__dirname, 'download.log'), downloadLog);
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
app.delete('/api/capture/delete/*', (req, res) => {
  try {
    const requestPath = req.params[0];
    const helper = new CaptureFileHelper();
    const filepath = helper.findFile(requestPath);
    const filename = filepath ? path.basename(filepath) : requestPath;
    const metadataFilepath = filepath ? helper.getMetadataPath(filepath) : null;
    
    // 파일 존재 확인
    if (!filepath) {
      return res.status(404).json({ error: 'File not found', requested: requestPath });
    }
    
    // 이미지 파일 삭제
    fs.unlinkSync(filepath);
    
    // 메타데이터 파일 삭제
    if (metadataFilepath && fs.existsSync(metadataFilepath)) {
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
