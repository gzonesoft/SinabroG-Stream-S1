# 🔧 RTMP 스트리밍 문제 해결 가이드

## 네트워크 오류 (networkError) 해결법

### 1. 스트림 키 확인
**문제:** 스트림 키가 없거나 잘못됨
- OBS에서 "스트림 키" 필드가 비어있음
- 잘못된 스트림 키 입력

**해결:**
```
1. 웹 관리 페이지에서 새 스트림 키 생성
2. OBS 설정 → 방송 → 스트림 키에 정확히 입력
3. 공백이나 특수문자 없이 입력
```

### 2. RTMP 서버 주소 확인
**문제:** 잘못된 RTMP URL 사용

**정확한 설정:**
```
서버: rtmp://ai.gzonesoft.com:17935/live
스트림 키: [생성된 키]
```

### 3. 방화벽 및 포트 문제
**문제:** 네트워크 차단

**해결:**
```
1. 방화벽에서 다음 포트 열기:
   - 17935 (RTMP 입력)
   - 17936 (웹 인터페이스)
   - 18001 (HTTP-FLV 출력)

2. 라우터 포트포워딩 설정 (필요시)
```

### 4. 브라우저 문제
**문제:** CORS 오류, HLS 미지원

**해결:**
```
1. Chrome 또는 Safari 사용 (권장)
2. 브라우저 캐시 삭제
3. VLC 플레이어로 대체 시청:
   http://ai.gzonesoft.com:18001/live/[키].flv
```

## OBS 설정 확인사항

### 올바른 설정 예시:
```
서비스: 사용자 정의
서버: rtmp://ai.gzonesoft.com:17935/live
스트림 키: ftl0snmu8l9bke7x2bs9p (예시)
```

### 잘못된 설정들:
```
❌ rtmp://ai.gzonesoft.com:17935/liveftl0snmu8l9bke7x2bs9p
   (키가 URL에 포함됨)

❌ rtmp://ai.gzonesoft.com:17935/
   (스트림 키 누락)

❌ rtmp://localhost:17935/live
   (localhost 사용)
```

## 시청 문제 해결

### 1. "Stream not found" 오류
**원인:** 
- 스트림이 실제로 시작되지 않음
- 잘못된 스트림 키로 시청 시도

**해결:**
1. 관리자 페이지에서 활성 스트림 확인
2. 올바른 스트림 키로 다시 시도
3. 스트림이 실제로 방송 중인지 확인

### 2. 버퍼링 또는 끊김
**해결:**
1. VLC 플레이어 사용
2. 네트워크 연결 확인
3. 다른 화질로 재시도

## 네트워크 진단 명령어

### 연결 테스트:
```bash
# RTMP 포트 테스트
telnet ai.gzonesoft.com 17935

# HTTP-FLV 포트 테스트
curl -I http://ai.gzonesoft.com:18001/live/test.flv

# 웹 인터페이스 테스트
curl -I http://ai.gzonesoft.com:17936
```

## 스트림 상태 확인

### 서버 로그 확인:
1. **연결 성공:** `[rtmp connect] id=xxx app=live`
2. **스트림 시작:** `[rtmp publish] New stream`
3. **오디오/비디오 수신:** `Handle audio/video`

### 문제 패턴:
```
❌ app=liveftl0snmu8l9bke7x2bs9p
   → OBS에서 키를 URL에 포함시킴

❌ StreamPath=/live/
   → 빈 스트림 키

✅ app=live, StreamPath=/live/abc123
   → 정상적인 설정
```

## 긴급 해결책

### VLC로 직접 시청:
```
1. VLC 실행
2. Ctrl+N (네트워크 스트림)
3. 다음 입력:
   http://ai.gzonesoft.com:18001/live/[스트림키].flv
```

### 모바일에서 시청:
```
1. VLC for Mobile 설치
2. 네트워크 스트림으로 FLV URL 입력
```

## 문의 및 지원

문제가 해결되지 않으면:
1. 관리자 페이지에서 실시간 로그 확인
2. 스트림 키 재생성 시도
3. 서버 관리자에게 문의

---
**참고:** 대부분의 네트워크 오류는 스트림 키 설정 문제입니다. OBS 설정을 다시 한번 확인해보세요!
