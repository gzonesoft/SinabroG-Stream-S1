#!/bin/bash

echo "🚁 DJI 드론 스트리밍 서버 + 실시간 오버레이 데이터 시작"
echo "============================================="

# 기존 프로세스 종료
echo "기존 프로세스 종료 중..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*update-overlay-data.js" 2>/dev/null || true

# 포트 정리
echo "포트 정리 중..."
lsof -ti:17935 | xargs kill -9 2>/dev/null || true
lsof -ti:17936 | xargs kill -9 2>/dev/null || true  
lsof -ti:17937 | xargs kill -9 2>/dev/null || true
lsof -ti:18001 | xargs kill -9 2>/dev/null || true
lsof -ti:18002 | xargs kill -9 2>/dev/null || true

sleep 2

# 스트리밍 서버 시작 (백그라운드)
echo "스트리밍 서버 시작 중..."
cd /Users/gzonesoft/SinabroG-Stream-S1
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

sleep 3

# 오버레이 데이터 업데이트 시작 (백그라운드) - 외부 앱에서 데이터 전송하므로 비활성화
# echo "실시간 오버레이 데이터 업데이트 시작 중..."
# nohup node update-overlay-data.js > overlay-data.log 2>&1 &
# OVERLAY_PID=$!
echo "오버레이 데이터는 외부 앱에서 POST API로 전송됩니다."
OVERLAY_PID="N/A"

sleep 2

# 프로세스 확인
echo "프로세스 상태 확인:"
echo "  스트리밍 서버 PID: $SERVER_PID"
echo "  오버레이 업데이트 PID: $OVERLAY_PID"

# 포트 확인
echo ""
echo "포트 사용 상태:"
lsof -i :17935,17936,17937,18001,18002 2>/dev/null || echo "포트 사용 정보를 가져올 수 없습니다"

echo ""
echo "============================================="
echo "🚀 서비스가 시작되었습니다!"
echo ""
echo "📡 RTMP 스트림 주소:"
echo "   rtmp://ai.gzonesoft.com:17935/live/[스트림키]"
echo ""
echo "🌐 웹 인터페이스:"
echo "   https://ai.gzonesoft.com:17937/"
echo "   https://ai.gzonesoft.com:17937/watch"
echo ""
echo "📊 오버레이 API:"
echo "   https://ai.gzonesoft.com:17937/api/overlay-data"
echo ""
echo "📋 PID 파일 생성..."
echo "$SERVER_PID" > /tmp/streaming-server.pid
# echo "$OVERLAY_PID" > /tmp/overlay-updater.pid  # 오버레이 업데이터 비활성화됨

echo ""
echo "로그 확인 명령어:"
echo "  tail -f /Users/gzonesoft/SinabroG-Stream-S1/server.log"
echo "  tail -f /Users/gzonesoft/SinabroG-Stream-S1/overlay-data.log"
echo ""
echo "서비스 종료 명령어:"
echo "  ./stop-all-services.sh"
echo ""
