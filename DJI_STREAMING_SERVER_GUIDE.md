# 🚁 DJI 드론 실시간 스트리밍 서버 프로젝트 지침서

## 📋 프로젝트 개요
DJI 드론을 위한 전문 실시간 스트리밍 서버 개발 및 운영 프로젝트입니다.

### 🎯 프로젝트 목표
- **주요 목적**: DJI 드론 실시간 스트리밍 서비스 제공
- **지원 기기**: DJI RC2, RC Pro, Smart Controller
- **핵심 기능**: RTMP 스트리밍, 웹 기반 관리/시청, SSL/HTTPS 지원
- **운영 방식**: 지속적인 기능 추가 및 개선

### 🔧 기술 스택
- **Backend**: Node.js, Express
- **Streaming**: node-media-server (RTMP)
- **Frontend**: HTML5, Bootstrap 5, Socket.IO
- **Security**: SSL/TLS, HTTPS
- **Database**: 메모리 기반 (향후 확장 가능)

---

## 📦 Git 저장소 정보

### 🌟 **GitHub 저장소**
```bash
https://github.com/gzonesoft/SinabroG-Stream-S1.git
```

### 🚀 **프로젝트 복제 및 설치**
```bash
# 저장소 클론
git clone https://github.com/gzonesoft/SinabroG-Stream-S1.git
cd SinabroG-Stream-S1

# 의존성 설치
npm install

# 서버 실행
npm start
# 또는 개발 모드
npm run dev
```

---

## 📁 현재 프로젝트 구조

```
dji-streaming-server/
├── package.json              # 프로젝트 설정 및 의존성 관리
├── server.js                 # 메인 서버 (RTMP + HTTP/HTTPS + Socket.IO)
├── public/                   # 웹 클라이언트 리소스
│   ├── index.html           # 관리자 대시보드 (메인 페이지)
│   ├── watch.html           # 시청자 페이지
│   ├── simple.html          # 간단 시청 페이지
│   ├── script.js            # 관리자 JavaScript
│   ├── viewer.js            # 시청자 JavaScript
│   └── style.css            # UI 스타일시트
├── media/                    # 미디어 파일 저장소 (녹화/임시파일)
├── ssl/                      # SSL 인증서 디렉토리 (선택사항)
├── README.md                 # 프로젝트 문서
├── TROUBLESHOOTING.md        # 문제 해결 가이드 (예정)
└── .gitignore               # Git 제외 파일
```

---

## 🚀 현재 구현된 기능

### ✅ 핵심 기능
- **RTMP 서버**: 포트 17935에서 DJI 드론 스트림 수신
- **HTTP/HTTPS 웹서버**: 포트 17936(HTTP), 17937(HTTPS)
- **실시간 통신**: Socket.IO 기반 실시간 상태 업데이트
- **스트림 관리**: 활성 스트림 추적 및 매핑
- **웹 인터페이스**: 관리자 대시보드 + 다중 시청 페이지

### ✅ DJI 드론 지원
- **DJI RC2**: 720p/30fps, 오디오 필수, 2Mbps
- **DJI RC Pro**: 4K/60fps, 저지연 모드, 15Mbps
- **Smart Controller**: 1080p/30fps, 8Mbps

### ✅ 보안 및 운영
- **SSL/TLS**: HTTPS 지원 (Let's Encrypt 호환)
- **CORS 설정**: 크로스 오리진 요청 처리
- **포트 관리**: 다중 포트 자동 관리
- **상태 모니터링**: 실시간 서버 상태 추적

---

## 🔄 개발 워크플로우

### 🛠️ 개발 명령어
```bash
# 개발 서버 시작
npm run dev          # nodemon 사용 (자동 재시작)

# 프로덕션 서버 시작
npm start            # 일반 실행

# 서버 완전 종료
npm run stop         # 모든 포트 종료

# 의존성 업데이트
npm update

# 새 기능 개발 시 브랜치 생성
git checkout -b feature/새기능명
```
### 📊 모니터링 및 디버깅
```bash
# 포트 사용 확인
lsof -i :17935,17936,17937,18001,18002

# 서버 로그 확인
tail -f server.log   # (로깅 시스템 구현 후)

# 프로세스 상태
ps aux | grep node
```

---

## 🎯 향후 개발 계획

### 🚀 단기 계획 (1-2주)
- [ ] **로깅 시스템**: Winston 기반 구조화된 로깅
- [ ] **데이터베이스**: SQLite/MongoDB 연동 (사용자/스트림 기록)
- [ ] **사용자 인증**: JWT 기반 관리자 로그인
- [ ] **스트림 녹화**: 자동 녹화 및 다운로드 기능
- [ ] **API 확장**: RESTful API 표준화

### 🏗️ 중기 계획 (1-2개월)
- [ ] **다중 화질**: HLS 적응형 스트리밍 지원
- [ ] **채팅 시스템**: 실시간 시청자 채팅
- [ ] **스트림 분석**: 시청 통계 및 분석 대시보드
- [ ] **알림 시스템**: 스트림 시작/종료 알림 (이메일/Slack)
- [ ] **CDN 연동**: 대용량 트래픽 대응

### 🌟 장기 계획 (3-6개월)
- [ ] **모바일 앱**: Flutter/React Native 시청 앱
- [ ] **AI 기능**: 자동 하이라이트 생성, 객체 인식
- [ ] **클러스터링**: 다중 서버 로드 밸런싱
- [ ] **상용화**: 결제 시스템, 구독 모델

---

## 🔧 개발 가이드라인

### 📝 코딩 표준
- **언어**: ES6+ JavaScript (Node.js)
- **코드 스타일**: Prettier + ESLint
- **네이밍**: camelCase (변수/함수), PascalCase (클래스)
- **주석**: JSDoc 표준 사용
- **에러 처리**: try-catch 필수, 적절한 로깅

### 🧪 테스트 전략
```bash
# 테스트 실행 (Jest 도입 예정)
npm test

# 통합 테스트
npm run test:integration

# 부하 테스트
npm run test:load
```### 🔐 보안 가이드라인
- **입력 검증**: 모든 사용자 입력 sanitize
- **HTTPS**: 프로덕션에서 필수
- **환경 변수**: 민감한 정보는 .env 파일 관리
- **정기 업데이트**: 의존성 보안 패치

---

## 🚨 문제 해결

### 일반적인 문제
```bash
# 포트 충돌 해결
sudo lsof -ti:17935 | xargs kill -9

# SSL 인증서 갱신
sudo certbot renew

# 메모리 부족 시
node --max-old-space-size=4096 server.js

# DJI 연결 실패 시
# 1. 방화벽 확인
# 2. RTMP URL 형식 검증
# 3. 네트워크 연결 상태 확인
```

### 로그 분석
- **RTMP 연결 로그**: `[NodeEvent on preConnect]` 확인
- **스트림 상태**: `activeStreams` Map 모니터링
- **클라이언트 연결**: Socket.IO 연결 상태 추적

---

## 📈 성능 최적화

### 서버 최적화
```javascript
// server.js 성능 튜닝 옵션
const rtmpConfig = {
  rtmp: {
    port: 17935,
    chunk_size: 60000,    // 대역폭에 따라 조정
    gop_cache: true,      // GOP 캐시 활성화
    ping: 30,             // 연결 유지
    ping_timeout: 60
  }
};
```

### 메모리 관리
- **스트림 맵**: 주기적 cleanup
- **소켓 연결**: 비활성 연결 자동 정리
- **미디어 파일**: 자동 삭제 스케줄링---

## 🤝 기여 가이드라인

### Git 워크플로우
```bash
# 기능 개발
git checkout -b feature/기능명
git commit -m "feat: 새로운 기능 추가"
git push origin feature/기능명

# 버그 수정
git checkout -b bugfix/이슈명
git commit -m "fix: 버그 수정 내용"

# 커밋 메시지 형식
# feat: 새 기능
# fix: 버그 수정
# docs: 문서 수정
# style: 코드 포맷팅
# refactor: 코드 리팩토링
# test: 테스트 추가
# chore: 기타 작업
```

### 코드 리뷰 체크리스트
- [ ] 기능 동작 확인
- [ ] 에러 처리 적절성
- [ ] 성능 영향 검토
- [ ] 보안 취약점 확인
- [ ] 문서 업데이트

---

## 📞 운영 지원

### 배포 환경
- **개발**: `http://localhost:17936`
- **테스트**: `https://test-domain.com:17937`
- **프로덕션**: `https://your-domain.com:17937`

### 모니터링 도구
- **서버 상태**: `/api/health` 엔드포인트
- **스트림 통계**: `/api/stats` API
- **실시간 대시보드**: 관리자 페이지### 백업 전략
```bash
# 설정 백업
cp -r dji-streaming-server dji-streaming-server.backup

# 데이터베이스 백업 (구현 후)
mongodump --db streaming_db --out ./backup/

# SSL 인증서 백업
cp -r /etc/letsencrypt/live/your-domain.com ./ssl-backup/
```

---

## 🎉 마일스톤

### ✅ v1.0 (현재 완료)
- RTMP 서버 구축
- 기본 웹 인터페이스
- DJI 드론 연동

### 🚧 v1.1 (진행 중)
- 로깅 시스템 구축
- 사용자 인증 추가
- API 표준화

### 🔮 v2.0 (계획)
- HLS 스트리밍 지원
- 모바일 앱 출시
- AI 기능 통합

---

## 📚 참고 자료

### 기술 문서
- [Node Media Server](https://github.com/illuspas/Node-Media-Server)
- [Socket.IO Documentation](https://socket.io/docs/)
- [DJI Developer API](https://developer.dji.com/)
- [RTMP Specification](https://rtmp.veriskope.com/docs/spec/)

### 유용한 도구
- **스트림 테스트**: [OBS Studio](https://obsproject.com/)
- **API 테스트**: [Postman](https://www.postman.com/)
- **모니터링**: [PM2](https://pm2.keymetrics.io/)---

## ⚠️ **중요한 개발 규칙**

### 🔴 **코드 수정 후 필수 작업**

**모든 개발소스 수정 작업 후에는 반드시 아래 명령어를 실행하여 Git에 커밋/푸쉬하세요!**

```bash
# 1. 변경사항 추가
git add .

# 2. 커밋 생성 (의미있는 메시지 작성)
git commit -m "feat: 수정 내용 요약"

# 3. GitHub에 푸쉬
git push origin main
```

### 📋 **커밋 메시지 가이드**
```bash
# 새 기능 추가
git commit -m "feat: DJI RC Pro 4K 지원 추가"

# 버그 수정
git commit -m "fix: RTMP 연결 끊김 문제 해결"

# 문서 업데이트
git commit -m "docs: 설치 가이드 업데이트"

# 성능 개선
git commit -m "perf: 스트림 버퍼링 최적화"

# UI 개선
git commit -m "style: 관리자 대시보드 디자인 개선"
```

---

## 🚨 **강력한 주의사항**

### ❗ **개발자 필독**

```bash
⚠️  소스코드 수정 후 Git 커밋/푸쉬는 필수입니다! ⚠️

작업 완료 → git add . → git commit -m "변경사항" → git push

이 과정을 빠뜨리면 다른 개발자나 서버에서 최신 코드를 
받을 수 없어 협업에 문제가 발생합니다.

항상 작업 완료 후 Git 업로드를 생활화하세요!
```

### 🔥 **1클릭 복사용 명령어**

```bash
git add . && git commit -m "feat: 코드 수정 및 개선" && git push origin main
```

---

*📝 이 지침서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*  
*🔄 마지막 업데이트: 2025년 9월 4일*  
*📦 GitHub: https://github.com/gzonesoft/SinabroG-Stream-S1.git*