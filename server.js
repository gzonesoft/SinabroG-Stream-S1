const express = require('express');
const NodeMediaServer = require('node-media-server');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// SSL 인증서 설정
const sslOptions = {
  key: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.key'),
  cert: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/20241115/ssl.crt'),
  passphrase: fs.readFileSync('/opt/homebrew/etc/nginx/ssl/ai.gzonesoft.com/password.txt', 'utf8').trim()
};

// HTTP와 HTTPS 서버 생성
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// Socket.IO는 HTTPS 서버에 연결
const io = socketIo(httpsServer, {
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

// PostgreSQL 연결 설정
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 17332,
  database: 'postgres',
  user: 'postgres',
  password: 'gzonesoft_supabase_2025_secure_db_password'
});

// 위치 이력 조회 API
app.post('/api/position-history/query', async (req, res) => {
  try {
    const { device_id, start_date, end_date, limit = 100 } = req.body;
    
    console.log('[API] Position history query:', { device_id, start_date, end_date, limit });
    
    // SQL 쿼리 실행
    const query = `
      SELECT * FROM ah_get_position_history(
        $1::VARCHAR,
        $2::TIMESTAMPTZ,
        $3::TIMESTAMPTZ,
        $4::INTEGER,
        FALSE
      ) ORDER BY position_timestamp DESC
    `;
    
    const result = await pool.query(query, [
      device_id,
      start_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_date || new Date().toISOString(),
      limit
    ]);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('[ERROR] Position history query failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '위치 이력 조회 중 오류가 발생했습니다.'
    });
  }
});

// 위치 저장 API
app.post('/api/position-history/save', async (req, res) => {
  try {
    const {
      device_id,
      latitude,
      longitude,
      altitude = 0,
      speed = 0,
      heading = 0,
      battery_level = null,
      timestamp = null,
      metadata = null,
      spare_text1 = null,
      spare_text2 = null,
      spare_text3 = null,
      spare_text4 = null,
      spare_text5 = null,
      spare_numeric1 = null,
      spare_numeric2 = null,
      spare_numeric3 = null,
      spare_json = null,
      custom_data = null
    } = req.body;
    
    console.log('[API] Position save request:', { device_id, latitude, longitude });
    
    const query = `
      SELECT ah_save_position_history(
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
    `;
    
    const result = await pool.query(query, [
      device_id, latitude, longitude, altitude, speed, heading, battery_level,
      timestamp, metadata ? JSON.stringify(metadata) : null,
      spare_text1, spare_text2, spare_text3, spare_text4, spare_text5,
      spare_numeric1, spare_numeric2, spare_numeric3,
      spare_json ? JSON.stringify(spare_json) : null,
      custom_data
    ]);
    
    res.json(result.rows[0].ah_save_position_history);
  } catch (error) {
    console.error('[ERROR] Position save failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '위치 저장 중 오류가 발생했습니다.'
    });
  }
});

// 현재 위치 조회 API
app.get('/api/position-history/current/:deviceId?', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const query = `SELECT * FROM ah_get_current_position($1)`;
    const result = await pool.query(query, [deviceId || null]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[ERROR] Current position query failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 통계 조회 API
app.get('/api/position-history/stats/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { days = 7 } = req.query;
    
    const query = `SELECT ah_get_position_stats($1, $2)`;
    const result = await pool.query(query, [deviceId, parseInt(days)]);
    
    res.json({
      success: true,
      data: result.rows[0].ah_get_position_stats
    });
  } catch (error) {
    console.error('[ERROR] Stats query failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
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

// HTTP 서버 (HTTP → HTTPS 리다이렉트)
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on port ${HTTP_PORT} (redirects to HTTPS)`);
});

// HTTPS 서버 (메인)
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running on port ${HTTPS_PORT}`);
  console.log(`RTMP server running on port 17935`);
  console.log(`HTTP-FLV server running on port 18001`);
  console.log(`HTTPS-FLV server running on port 18002`);
});

// HTTP → HTTPS 리다이렉트 미들웨어
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && req.secure === false) {
    return res.redirect(301, `https://${req.header('host').replace(':17936', ':17937')}${req.url}`);
  }
  next();
});

nms.run();

console.log('RTMP Streaming Service Started!');
console.log('==========================================');
console.log('RTMP URL: rtmp://ai.gzonesoft.com:17935/live');
console.log('HTTP Interface: http://ai.gzonesoft.com:17936 (redirects to HTTPS)');
console.log('HTTPS Interface: https://ai.gzonesoft.com:17937');
console.log('HTTPS-FLV Stream: https://ai.gzonesoft.com:18002/live/[key].flv');
console.log('==========================================');
