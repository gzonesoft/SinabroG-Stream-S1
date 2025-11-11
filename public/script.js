// RTMP 스트리밍 서비스 클라이언트 JavaScript

class RTMPStreamingClient {
    constructor() {
        this.socket = null;
        this.activeStreams = [];
        this.startTime = new Date();
        this.isConnected = false;
        
        this.init();
    }
    
    init() {
        this.connectSocket();
        this.updateUptime();
        this.setupEventListeners();
        this.loadInitialData();
    }
    
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateConnectionStatus();
            this.addLog('소켓 연결 성공', 'success');
            this.showNotification('서버에 연결되었습니다', 'success');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.updateConnectionStatus();
            this.addLog('소켓 연결 해제', 'warning');
            this.showNotification('서버 연결이 해제되었습니다', 'warning');
        });
        
        this.socket.on('activeStreams', (streams) => {
            this.activeStreams = streams;
            this.updateStreamsList();
            this.updateStats();
        });
        
        this.socket.on('streamStarted', (streamInfo) => {
            this.addLog(`새 스트림 시작: ${streamInfo.streamKey}`, 'info');
            this.showNotification(`새 스트림이 시작되었습니다: ${streamInfo.streamKey}`, 'info');
            this.refreshStreams();
        });
        
        this.socket.on('streamEnded', (streamInfo) => {
            this.addLog(`스트림 종료: ${streamInfo.streamPath}`, 'warning');
            this.showNotification('스트림이 종료되었습니다', 'warning');
            this.refreshStreams();
        });
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (this.isConnected) {
            statusElement.textContent = '연결됨';
            statusElement.className = 'text-success';
        } else {
            statusElement.textContent = '연결 해제됨';
            statusElement.className = 'text-danger';
        }
    }
    
    updateUptime() {
        setInterval(() => {
            const now = new Date();
            const diff = now - this.startTime;
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) {
                uptimeElement.textContent = uptime;
            }
        }, 1000);
    }
    
    updateStats() {
        const activeStreamsCount = this.activeStreams.length;
        const totalViewers = this.activeStreams.reduce((total, stream) => total + (stream.viewers || 0), 0);
        
        document.getElementById('activeStreamsCount').textContent = activeStreamsCount;
        document.getElementById('totalViewers').textContent = totalViewers;
    }
    
    updateStreamsList() {
        const streamsList = document.getElementById('streamsList');
        
        if (this.activeStreams.length === 0) {
            streamsList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-broadcast-tower fa-3x mb-3"></i>
                    <p>현재 활성 스트림이 없습니다</p>
                </div>
            `;
            return;
        }
        
        const streamsHtml = this.activeStreams.map(stream => {
            const startTime = new Date(stream.startTime);
            const duration = this.formatDuration(new Date() - startTime);
            
            return `
                <div class="stream-item fade-in">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-2">
                                <span class="stream-status live">
                                    <i class="fas fa-circle me-1"></i>
                                    LIVE
                                </span>
                                <span class="ms-2">${stream.streamKey}</span>
                            </h6>
                            <div class="stream-info">
                                <div>
                                    <small class="text-muted">
                                        <i class="fas fa-clock me-1"></i>
                                        ${duration}
                                    </small>
                                    <small class="text-muted ms-3">
                                        <i class="fas fa-users me-1"></i>
                                        시청자: ${stream.viewers || 0}명
                                    </small>
                                </div>
                                <div class="stream-actions">
                                    <button class="btn btn-sm btn-primary" onclick="watchStream('${stream.streamKey}')">
                                        <i class="fas fa-play me-1"></i>
                                        시청
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="copyStreamUrl('${stream.streamKey}')">
                                        <i class="fas fa-copy me-1"></i>
                                        URL 복사
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        streamsList.innerHTML = streamsHtml;
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}시간 ${minutes % 60}분`;
        } else if (minutes > 0) {
            return `${minutes}분 ${seconds % 60}초`;
        } else {
            return `${seconds}초`;
        }
    }
    
    addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        let icon = 'fas fa-info-circle';
        switch (type) {
            case 'success':
                icon = 'fas fa-check-circle';
                break;
            case 'warning':
                icon = 'fas fa-exclamation-triangle';
                break;
            case 'error':
                icon = 'fas fa-times-circle';
                break;
        }
        
        logEntry.innerHTML = `<i class="${icon} me-2"></i>[${timestamp}] ${message}`;
        logContainer.appendChild(logEntry);
        
        // 로그 컨테이너 스크롤을 맨 아래로
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // 로그가 너무 많으면 오래된 것 제거
        const logEntries = logContainer.querySelectorAll('.log-entry');
        if (logEntries.length > 100) {
            logEntries[0].remove();
        }
    }
    
    showNotification(message, type = 'info') {
        const toastBody = document.getElementById('toastBody');
        const toast = document.getElementById('notificationToast');
        
        toastBody.textContent = message;
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
    
    setupEventListeners() {
        // 페이지 로드 시 스트림 키 자동 생성
        this.generateStreamKey();
    }
    
    loadInitialData() {
        this.refreshStreams();
    }
    
    async refreshStreams() {
        try {
            const response = await fetch('/api/streams');
            this.activeStreams = await response.json();
            this.updateStreamsList();
            this.updateStats();
        } catch (error) {
            console.error('Failed to refresh streams:', error);
            this.addLog('스트림 목록 새로고침 실패', 'error');
        }
    }
    
    async generateStreamKey() {
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            document.getElementById('streamKey').value = data.streamKey;
            this.addLog('새 스트림 키 생성됨', 'success');
        } catch (error) {
            console.error('Failed to generate stream key:', error);
            this.addLog('스트림 키 생성 실패', 'error');
        }
    }
}

// 전역 함수들
let streamingClient;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    streamingClient = new RTMPStreamingClient();
});

// 클립보드에 복사
async function copyToClipboard(elementId) {
    try {
        const element = document.getElementById(elementId);
        const text = element.value || element.textContent;
        
        await navigator.clipboard.writeText(text);
        
        streamingClient.showNotification('클립보드에 복사되었습니다', 'success');
        streamingClient.addLog(`클립보드에 복사: ${text}`, 'success');
        
        // 버튼 애니메이션
        const button = event.target;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            button.innerHTML = originalHTML;
        }, 1000);
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        streamingClient.showNotification('복사에 실패했습니다', 'error');
    }
}

// 스트림 키 생성
function generateStreamKey() {
    streamingClient.generateStreamKey();
}

// 스트림 새로고침
function refreshStreams() {
    streamingClient.refreshStreams();
    streamingClient.addLog('스트림 목록 새로고침', 'info');
}

// 로그 지우기
function clearLogs() {
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '<div class="text-success">[INFO] 로그가 지워졌습니다</div>';
}

// 스트림 재생
function playStream() {
    const streamKey = document.getElementById('playStreamKey').value;
    
    if (!streamKey) {
        streamingClient.showNotification('스트림 키를 입력해주세요', 'warning');
        return;
    }
    
    watchStream(streamKey);
}

// 스트림 시청 (FLV.js 사용)
function watchStream(streamKey) {
    const videoPlayer = document.getElementById('videoPlayer');
    const actualStreamKey = streamKey === 'live' ? 'live' : streamKey;
    
    const flvUrl = `http://ai.gzonesoft.com:18001/live/${actualStreamKey}.flv`;
    
    console.log('Attempting to play FLV stream:', flvUrl);
    streamingClient.addLog(`FLV.js로 스트림 재생 시도: ${actualStreamKey}`, 'info');
    
    // FLV.js 지원 확인
    if (flvjs && flvjs.isSupported()) {
        videoPlayer.innerHTML = `
            <video id="streamVideo" controls muted class="w-100 h-100" style="background: #000;">
                브라우저가 FLV 재생을 지원하지 않습니다.
            </video>
            <div class="position-absolute top-0 end-0 p-2">
                <small class="badge bg-danger">LIVE</small>
            </div>
        `;
        
        const videoElement = videoPlayer.querySelector('#streamVideo');
        
        // FLV.js 플레이어 생성
        const flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: flvUrl,
            isLive: true,
            hasAudio: true,
            hasVideo: true,
            cors: true
        }, {
            enableWorker: false,
            enableStashBuffer: false,
            stashInitialSize: undefined,
            lazyLoad: false,
            lazyLoadMaxDuration: 3 * 60,
            lazyLoadRecoverDuration: 30,
            deferLoadAfterSourceOpen: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: 3 * 60,
            autoCleanupMinBackwardDuration: 2 * 60,
            statisticsInfoReportInterval: 600,
            fixAudioTimestampGap: true,
            accurateSeek: false,
            seekType: 'range',
            seekParamStart: 'bstart',
            seekParamEnd: 'bend',
            rangeLoadZeroStart: false,
            lazyLoadStartOffset: 0,
            reuseRedirectedURL: false,
            referrerPolicy: 'no-referrer-when-downgrade'
        });
        
        // 이벤트 리스너 추가
        flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
            streamingClient.addLog('FLV 스트림 로딩 완료', 'success');
        });
        
        flvPlayer.on(flvjs.Events.LOADED_METADATA, () => {
            streamingClient.addLog('FLV 메타데이터 로드됨', 'success');
        });
        
        flvPlayer.on(flvjs.Events.MEDIA_INFO, (info) => {
            console.log('FLV Media Info:', info);
            streamingClient.addLog(`FLV 미디어 정보: ${info.width}x${info.height}`, 'info');
        });
        
        flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
            console.error('FLV Player Error:', errorType, errorDetail, errorInfo);
            streamingClient.addLog(`FLV 재생 오류: ${errorType} - ${errorDetail}`, 'error');
            
            // 오류 시 대체 방법 표시
            showAlternativeMethods(actualStreamKey, [flvUrl]);
        });
        
        // 비디오 엘리먼트 이벤트
        videoElement.addEventListener('canplay', () => {
            streamingClient.addLog('스트림 재생 준비 완료!', 'success');
            streamingClient.showNotification('스트림 재생 준비 완료!', 'success');
        });
        
        videoElement.addEventListener('playing', () => {
            streamingClient.addLog(`스트림 재생 시작: ${actualStreamKey}`, 'success');
        });
        
        videoElement.addEventListener('waiting', () => {
            streamingClient.addLog('버퍼링 중...', 'warning');
        });
        
        // 플레이어를 비디오 엘리먼트에 연결
        flvPlayer.attachMediaElement(videoElement);
        
        try {
            // 스트림 로드 및 재생
            flvPlayer.load();
            
            // 자동 재생 시도
            setTimeout(() => {
                videoElement.play().then(() => {
                    streamingClient.addLog('자동 재생 성공!', 'success');
                }).catch(e => {
                    console.warn('Auto-play failed:', e);
                    streamingClient.addLog('자동 재생 실패 - 재생 버튼을 클릭하세요', 'warning');
                });
            }, 1000);
            
            // 전역에서 접근 가능하도록 저장
            window.currentFlvPlayer = flvPlayer;
            
        } catch (error) {
            console.error('FLV Player creation failed:', error);
            streamingClient.addLog('FLV 플레이어 생성 실패', 'error');
            showAlternativeMethods(actualStreamKey, [flvUrl]);
        }
        
    } else {
        streamingClient.addLog('FLV.js가 지원되지 않는 브라우저입니다', 'error');
        showAlternativeMethods(actualStreamKey, [flvUrl]);
    }
    
    // 재생할 스트림 키 입력란에 값 설정
    document.getElementById('playStreamKey').value = actualStreamKey;
}

// 대체 방법 표시
function showAlternativeMethods(streamKey, urls) {
    const videoPlayer = document.getElementById('videoPlayer');
    
    videoPlayer.innerHTML = `
        <div class="text-center text-white p-4">
            <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
            <h5>브라우저 재생 실패</h5>
            <p class="mb-3">다음 방법들을 시도해보세요:</p>
            
            <div class="d-grid gap-2 mb-3">
                <button class="btn btn-primary" onclick="openInVLC('${urls[0]}')">
                    <i class="fas fa-play me-2"></i>VLC로 열기
                </button>
                <button class="btn btn-success" onclick="copyStreamUrl('${streamKey}')">
                    <i class="fas fa-copy me-2"></i>URL 복사
                </button>
                <button class="btn btn-info" onclick="window.open('/test', '_blank')">
                    <i class="fas fa-tools me-2"></i>테스트 페이지
                </button>
            </div>
            
            <div class="text-start">
                <h6 class="mb-2">시도해볼 URL들:</h6>
                ${urls.map(url => `
                    <div class="mb-2">
                        <code class="bg-dark p-2 rounded d-block" style="font-size: 0.8em;">
                            ${url}
                        </code>
                        <button class="btn btn-sm btn-outline-light mt-1" onclick="copyUrl('${url}')">
                            복사
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// URL 복사 헬퍼
async function copyUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        streamingClient.showNotification('URL이 복사되었습니다', 'success');
    } catch (error) {
        prompt('URL을 복사하세요:', url);
    }
}

// 스트림 URL 복사
async function copyStreamUrl(streamKey) {
    const streamUrl = `http://ai.gzonesoft.com:18001/live/${streamKey}.flv`;
    
    try {
        await navigator.clipboard.writeText(streamUrl);
        streamingClient.showNotification('스트림 URL이 복사되었습니다', 'success');
    } catch (error) {
        console.error('Failed to copy stream URL:', error);
        streamingClient.showNotification('URL 복사에 실패했습니다', 'error');
    }
}

// 페이지 가시성 변경 시 처리
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && streamingClient) {
        // 페이지가 다시 보이면 스트림 목록 새로고침
        streamingClient.refreshStreams();
    }
});

// 페이지 언로드 시 FLV 플레이어 정리
window.addEventListener('beforeunload', () => {
    if (window.currentFlvPlayer) {
        try {
            window.currentFlvPlayer.pause();
            window.currentFlvPlayer.unload();
            window.currentFlvPlayer.detachMediaElement();
            window.currentFlvPlayer.destroy();
        } catch (e) {
            console.warn('FLV player cleanup failed:', e);
        }
    }
});

// 키보드 단축키
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + R: 스트림 새로고침
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        refreshStreams();
    }
    
    // Ctrl/Cmd + G: 스트림 키 생성
    if ((event.ctrlKey || event.metaKey) && event.key === 'g') {
        event.preventDefault();
        generateStreamKey();
    }
});
