/**
 * 위치정보 전송 모니터링 대시보드
 */

class PositionMonitor {
    constructor() {
        this.isMonitoring = false;
        this.updateInterval = null;
        this.logMessages = [];
        this.maxLogMessages = 100;
        
        this.initializeElements();
        this.setupEventListeners();
        this.startMonitoring();
    }

    initializeElements() {
        // 통계 요소들
        this.elements = {
            totalSent: document.getElementById('totalSent'),
            totalFailed: document.getElementById('totalFailed'),
            queueSize: document.getElementById('queueSize'),
            successRate: document.getElementById('successRate'),
            successProgress: document.getElementById('successProgress'),
            
            // API 상태 요소들
            apiStatus: document.getElementById('apiStatus'),
            apiStatusText: document.getElementById('apiStatusText'),
            apiUrl: document.getElementById('apiUrl'),
            lastSentTime: document.getElementById('lastSentTime'),
            lastError: document.getElementById('lastError'),
            autoSendStatus: document.getElementById('autoSendStatus'),
            sendInterval: document.getElementById('sendInterval'),
            batchSize: document.getElementById('batchSize'),
            
            // 실시간 데이터 요소들
            currentLat: document.getElementById('currentLat'),
            currentLng: document.getElementById('currentLng'),
            currentAlt: document.getElementById('currentAlt'),
            currentSpeed: document.getElementById('currentSpeed'),
            currentAzimuth: document.getElementById('currentAzimuth'),
            currentBattery: document.getElementById('currentBattery'),
            currentFlightMode: document.getElementById('currentFlightMode'),
            lastUpdate: document.getElementById('lastUpdate'),
            
            // 큐 상태 요소들
            queueCount: document.getElementById('queueCount'),
            hashCacheSize: document.getElementById('hashCacheSize'),
            queueLog: document.getElementById('queueLog'),
            
            // 로그 컨테이너
            logContainer: document.getElementById('logContainer')
        };
    }

    setupEventListeners() {
        // 페이지 언로드 시 모니터링 중지
        window.addEventListener('beforeunload', () => {
            this.stopMonitoring();
        });
    }

    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.log('info', '모니터링 시작됨');
        
        // 즉시 업데이트
        this.updateDashboard();
        
        // 정기 업데이트 (2초마다)
        this.updateInterval = setInterval(() => {
            this.updateDashboard();
        }, 2000);
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.log('warning', '모니터링 중지됨');
    }

    async updateDashboard() {
        try {
            // Position API 상태 확인
            await this.updateAPIStatus();
            
            // 실시간 위치 데이터 업데이트
            await this.updateRealtimeData();
            
            // 통계 업데이트
            this.updateStats();
            
        } catch (error) {
            this.log('error', `대시보드 업데이트 실패: ${error.message}`);
        }
    }

    async updateAPIStatus() {
        if (!window.positionAPI) {
            this.setAPIStatus('inactive', 'Position API 클라이언트가 로드되지 않음');
            return;
        }

        const stats = window.positionAPI.getStats();
        
        // API 설정 정보 표시
        this.elements.apiUrl.textContent = window.positionAPI.apiUrl || 'http://localhost:17321';
        this.elements.sendInterval.textContent = `${(window.positionAPI.config?.SEND_INTERVAL || 5000) / 1000}초`;
        this.elements.batchSize.textContent = `${window.positionAPI.config?.BATCH_SIZE || 100}개`;
        this.elements.autoSendStatus.textContent = stats.isAutoSending ? '활성' : '비활성';
        
        // 마지막 전송 시간
        if (stats.lastSentTime) {
            this.elements.lastSentTime.textContent = new Date(stats.lastSentTime).toLocaleString('ko-KR');
        }
        
        // 마지막 오류
        if (stats.lastError) {
            this.elements.lastError.textContent = stats.lastError;
        }

        // API 상태 판단
        if (stats.isAutoSending) {
            if (stats.lastError && Date.now() - new Date(stats.lastSentTime || 0).getTime() > 30000) {
                this.setAPIStatus('warning', '전송 중 오류 발생');
            } else {
                this.setAPIStatus('active', '정상 동작 중');
            }
        } else {
            this.setAPIStatus('inactive', '자동 전송 비활성');
        }
    }

    async updateRealtimeData() {
        try {
            const response = await fetch('/api/overlay-data');
            const data = await response.json();
            
            if (data) {
                this.elements.currentLat.textContent = data.LATITUDE?.toFixed(6) || '-';
                this.elements.currentLng.textContent = data.LONGITUDE?.toFixed(6) || '-';
                this.elements.currentAlt.textContent = data.ALTITUDE ? `${data.ALTITUDE.toFixed(1)}m` : '-';
                this.elements.currentSpeed.textContent = data.SPEED ? `${data.SPEED.toFixed(1)}m/s` : '-';
                this.elements.currentAzimuth.textContent = data.AZIMUTH ? `${data.AZIMUTH.toFixed(1)}°` : '-';
                this.elements.currentBattery.textContent = data.BATTERY_LEVEL ? `${data.BATTERY_LEVEL}%` : '-';
                this.elements.currentFlightMode.textContent = data.FLIGHT_MODE || '-';
                this.elements.lastUpdate.textContent = data._lastUpdated ? 
                    new Date(data._lastUpdated).toLocaleTimeString('ko-KR') : '-';
            }
        } catch (error) {
            this.log('error', `실시간 데이터 수신 실패: ${error.message}`);
        }
    }

    updateStats() {
        if (!window.positionAPI) {
            return;
        }

        const stats = window.positionAPI.getStats();
        
        // 통계 업데이트
        this.elements.totalSent.textContent = stats.totalSent || 0;
        this.elements.totalFailed.textContent = stats.totalFailed || 0;
        this.elements.queueSize.textContent = stats.queueSize || 0;
        this.elements.queueCount.textContent = `${stats.queueSize || 0}개`;
        this.elements.hashCacheSize.textContent = `${stats.hashCacheSize || 0}개`;

        // 성공률 계산
        const total = (stats.totalSent || 0) + (stats.totalFailed || 0);
        const successRate = total > 0 ? ((stats.totalSent || 0) / total * 100) : 0;
        
        this.elements.successRate.textContent = `${successRate.toFixed(1)}%`;
        this.elements.successProgress.style.width = `${successRate}%`;

        // 큐 로그 업데이트
        this.updateQueueLog(stats);
    }

    updateQueueLog(stats) {
        const queueLog = this.elements.queueLog;
        
        // 큐 상태 로그 생성
        const logs = [];
        
        if (stats.queueSize > 0) {
            logs.push(`📤 ${stats.queueSize}개 데이터 전송 대기 중`);
        }
        
        if (stats.isAutoSending) {
            logs.push(`🔄 자동 전송 활성 (${(window.positionAPI.config?.SEND_INTERVAL || 5000) / 1000}초 간격)`);
        }
        
        if (stats.lastError) {
            logs.push(`❌ 마지막 오류: ${stats.lastError}`);
        }
        
        if (stats.totalSent > 0) {
            logs.push(`✅ 총 ${stats.totalSent}개 데이터 전송 완료`);
        }

        if (logs.length === 0) {
            logs.push('대기 중...');
        }

        queueLog.innerHTML = logs.map(log => `<div class="log-entry log-info">${log}</div>`).join('');
    }

    setAPIStatus(status, message) {
        const statusElement = this.elements.apiStatus;
        const textElement = this.elements.apiStatusText;
        
        // 상태 표시기 클래스 제거
        statusElement.className = 'status-indicator';
        
        // 새 상태 클래스 추가
        switch (status) {
            case 'active':
                statusElement.classList.add('status-active');
                break;
            case 'warning':
                statusElement.classList.add('status-warning');
                break;
            case 'inactive':
            default:
                statusElement.classList.add('status-inactive');
                break;
        }
        
        textElement.textContent = message;
    }

    log(level, message) {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        const logEntry = `[${timestamp}] ${message}`;
        
        // 로그 메시지 배열에 추가
        this.logMessages.unshift({
            level,
            message: logEntry,
            timestamp: Date.now()
        });
        
        // 최대 로그 수 제한
        if (this.logMessages.length > this.maxLogMessages) {
            this.logMessages = this.logMessages.slice(0, this.maxLogMessages);
        }
        
        // 로그 컨테이너 업데이트
        this.updateLogDisplay();
        
        // 콘솔에도 출력
        console.log(`[Position Monitor] ${logEntry}`);
    }

    updateLogDisplay() {
        const container = this.elements.logContainer;
        
        const logHTML = this.logMessages.map(log => 
            `<div class="log-entry log-${log.level}">${log.message}</div>`
        ).join('');
        
        container.innerHTML = logHTML;
        
        // 스크롤을 맨 위로
        container.scrollTop = 0;
    }

    // 외부에서 호출할 수 있는 메서드들
    async migrateLocalStorage() {
        if (!window.positionAPI) {
            this.log('error', 'Position API 클라이언트가 로드되지 않음');
            return;
        }

        this.log('info', 'localStorage 마이그레이션 시작...');
        
        try {
            const result = await window.positionAPI.migrateFromLocalStorage();
            
            if (result.success) {
                this.log('success', `✅ ${result.count}개 데이터 마이그레이션 완료`);
            } else {
                this.log('error', `❌ 마이그레이션 실패: ${result.error}`);
            }
        } catch (error) {
            this.log('error', `마이그레이션 중 오류: ${error.message}`);
        }
    }

    async retryFailed() {
        if (!window.positionAPI) {
            this.log('error', 'Position API 클라이언트가 로드되지 않음');
            return;
        }

        this.log('info', '실패 데이터 재전송 시작...');
        
        try {
            const result = await window.positionAPI.retryFailedPositions();
            
            if (result.success) {
                this.log('success', `✅ ${result.count}개 실패 데이터 재전송 완료`);
            } else {
                this.log('error', `❌ 재전송 실패: ${result.error}`);
            }
        } catch (error) {
            this.log('error', `재전송 중 오류: ${error.message}`);
        }
    }

    clearStats() {
        if (!window.positionAPI) {
            this.log('error', 'Position API 클라이언트가 로드되지 않음');
            return;
        }

        // 통계 초기화
        window.positionAPI.stats = {
            totalSent: 0,
            totalFailed: 0,
            lastSentTime: null,
            lastError: null
        };
        
        // 해시 캐시 초기화
        window.positionAPI.sentHashes.clear();
        
        this.log('warning', '통계가 초기화되었습니다');
        
        // 즉시 대시보드 업데이트
        this.updateStats();
    }
}

// 전역 함수들 (HTML에서 호출)
function startMonitoring() {
    if (window.positionMonitor) {
        window.positionMonitor.startMonitoring();
    }
}

function stopMonitoring() {
    if (window.positionMonitor) {
        window.positionMonitor.stopMonitoring();
    }
}

function migrateLocalStorage() {
    if (window.positionMonitor) {
        window.positionMonitor.migrateLocalStorage();
    }
}

function retryFailed() {
    if (window.positionMonitor) {
        window.positionMonitor.retryFailed();
    }
}

function clearStats() {
    if (window.positionMonitor) {
        window.positionMonitor.clearStats();
    }
}

// 페이지 로드 시 모니터링 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    // Position API가 로드될 때까지 대기
    const initMonitor = () => {
        if (typeof PositionAPIClient !== 'undefined') {
            window.positionMonitor = new PositionMonitor();
        } else {
            setTimeout(initMonitor, 100);
        }
    };
    
    initMonitor();
});

console.log('📊 Position Monitor 스크립트 로드됨');