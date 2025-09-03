#!/bin/bash
# DJI 스트리밍 서버 시작 스크립트

echo "🚀 DJI 스트리밍 서버 시작 중..."

# 현재 디렉토리 확인
if [ ! -f "server.js" ]; then
    echo "❌ server.js 파일을 찾을 수 없습니다."
    echo "📂 올바른 디렉토리에서 실행하세요: /Users/gzonesoft/SinabroG-Stream-S1"
    exit 1
fi

# 기존 서버가 실행 중인지 확인
EXISTING_PID=$(ps aux | grep "server.js" | grep -v grep | awk '{print $2}')
if [ ! -z "$EXISTING_PID" ]; then
    echo "⚠️  기존 서버가 실행 중입니다 (PID: $EXISTING_PID)"
    echo "🛑 기존 서버를 중지합니다..."
    ./stop-server.sh
    sleep 2
fi

# 포트 충돌 확인
PORTS_IN_USE=$(lsof -i :17935,17936,17937,18001,18002 2>/dev/null)
if [ ! -z "$PORTS_IN_USE" ]; then
    echo "🔧 포트 정리 중..."
    lsof -ti:17935,17936,17937,18001,18002 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 서버 시작
echo "▶️  서버 시작 중..."
npm start

echo "✅ 서버가 시작되었습니다!"
echo ""
echo "🌐 접속 주소:"
echo "   관리자: https://ai.gzonesoft.com:17937"
echo "   시청자: https://ai.gzonesoft.com:17937/watch"
echo "   RTMP: rtmp://ai.gzonesoft.com:17935/live"
