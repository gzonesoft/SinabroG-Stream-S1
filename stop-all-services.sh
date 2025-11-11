#!/bin/bash

echo "🛑 DJI 드론 스트리밍 서버 + 오버레이 데이터 업데이트 종료"
echo "=================================================="

# PID 파일에서 프로세스 ID 읽기
if [ -f /tmp/streaming-server.pid ]; then
    SERVER_PID=$(cat /tmp/streaming-server.pid)
    echo "스트리밍 서버 종료 중... (PID: $SERVER_PID)"
    kill -TERM $SERVER_PID 2>/dev/null || true
    rm -f /tmp/streaming-server.pid
fi

if [ -f /tmp/overlay-updater.pid ]; then
    OVERLAY_PID=$(cat /tmp/overlay-updater.pid)
    echo "오버레이 업데이터 종료 중... (PID: $OVERLAY_PID)"
    kill -INT $OVERLAY_PID 2>/dev/null || true
    rm -f /tmp/overlay-updater.pid
fi

# 프로세스 이름으로도 종료 시도
echo "관련 프로세스 정리 중..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*update-overlay-data.js" 2>/dev/null || true

# 포트 강제 정리
echo "포트 정리 중..."
lsof -ti:17935 | xargs kill -9 2>/dev/null || true
lsof -ti:17936 | xargs kill -9 2>/dev/null || true  
lsof -ti:17937 | xargs kill -9 2>/dev/null || true
lsof -ti:18001 | xargs kill -9 2>/dev/null || true
lsof -ti:18002 | xargs kill -9 2>/dev/null || true

sleep 2

# 상태 확인
echo ""
echo "포트 사용 상태 확인:"
PORTS_IN_USE=$(lsof -i :17935,17936,17937,18001,18002 2>/dev/null)
if [ -z "$PORTS_IN_USE" ]; then
    echo "✅ 모든 포트가 정리되었습니다"
else
    echo "⚠️  아직 사용중인 포트가 있습니다:"
    echo "$PORTS_IN_USE"
fi

# 프로세스 상태 확인
echo ""
echo "프로세스 상태 확인:"
NODE_PROCESSES=$(ps aux | grep -E "(server\.js|update-overlay-data\.js)" | grep -v grep)
if [ -z "$NODE_PROCESSES" ]; then
    echo "✅ 모든 관련 프로세스가 종료되었습니다"
else
    echo "⚠️  아직 실행중인 프로세스가 있습니다:"
    echo "$NODE_PROCESSES"
fi

echo ""
echo "=============================================="
echo "🔴 서비스가 종료되었습니다"
echo ""
