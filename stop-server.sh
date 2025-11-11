#!/bin/bash
# DJI 스트리밍 서버 중지 스크립트

echo "🛑 DJI 스트리밍 서버 중지 중..."

# 1. server.js 프로세스 중지
echo "📋 server.js 프로세스 검색 중..."
SERVER_PID=$(ps aux | grep "server.js" | grep -v grep | awk '{print $2}')

if [ ! -z "$SERVER_PID" ]; then
    echo "🔄 server.js 프로세스 종료 중... (PID: $SERVER_PID)"
    kill $SERVER_PID
    sleep 2
    
    # 강제 종료가 필요한지 확인
    if ps -p $SERVER_PID > /dev/null; then
        echo "⚠️  정상 종료 실패, 강제 종료 중..."
        kill -9 $SERVER_PID
    fi
else
    echo "ℹ️  server.js 프로세스가 실행되지 않음"
fi

# 2. 포트별 완전 정리
echo "🔧 관련 포트 정리 중... (17935, 17936, 17937, 18001, 18002)"
lsof -ti:17935,17936,17937,18001,18002 2>/dev/null | xargs kill -9 2>/dev/null

# 3. 최종 상태 확인
echo "✅ 서버 중지 완료!"
echo ""
echo "📊 현재 상태:"
REMAINING=$(lsof -i :17935,17936,17937,18001,18002 2>/dev/null)
if [ -z "$REMAINING" ]; then
    echo "✅ 모든 포트가 해제되었습니다."
else
    echo "⚠️  일부 포트가 여전히 사용 중입니다:"
    echo "$REMAINING"
fi
