/**
 * 위치정보 이력 API 클라이언트
 * 드론 위치 데이터를 외부 API로 전송하는 시스템
 */

// API 설정
const POSITION_API_CONFIG = {
    SUPABASE_URL: "http://localhost:17321",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NzM2NzgwLCJleHAiOjE3ODkyNzI3ODB9.ysKG7uo3HrMGeO8evJAs-ce01Jp-xxZ0CWa6ZQTcdVY", // 2025년 유효한 JWT 토큰
    BATCH_SIZE: 100,
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000, // 1초
    SEND_INTERVAL: 5000, // 5초마다 배치 전송
    MAX_QUEUE_SIZE: 1000
};

// API 헤더 설정
const POSITION_API_HEADERS = {
    'apikey': POSITION_API_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${POSITION_API_CONFIG.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

/**
 * 위치정보 API 클라이언트
 */
class PositionAPIClient {
    constructor(config = POSITION_API_CONFIG) {
        this.config = config;
        this.apiUrl = config.SUPABASE_URL;
        this.apiKey = config.SUPABASE_ANON_KEY;
        this.headers = POSITION_API_HEADERS;
        
        // 전송 큐
        this.queue = [];
        this.sending = false;
        this.sendTimer = null;
        
        // 통계
        this.stats = {
            totalSent: 0,
            totalFailed: 0,
            lastSentTime: null,
            lastError: null
        };
        
        // 중복 방지를 위한 해시 저장
        this.sentHashes = new Set();
        
        // 자동 전송 시작
        this.startAutoSend();
    }

    /**
     * 위치 데이터 해시 생성 (중복 방지)
     */
    generatePositionHash(position) {
        return `${position.DEVICE_ID || 'unknown'}_${position.TIMESTAMP_UNIX || position.timestamp}`;
    }

    /**
     * 단일 위치 전송
     */
    async sendPosition(position) {
        // 큐에 추가
        this.addToQueue(position);
        
        // 큐가 가득 차면 즉시 전송
        if (this.queue.length >= this.config.BATCH_SIZE) {
            await this.processQueue();
        }
    }

    /**
     * 큐에 위치 추가
     */
    addToQueue(position) {
        const hash = this.generatePositionHash(position);
        
        // 중복 체크
        if (this.sentHashes.has(hash)) {
            console.log('⚠️ 중복 위치 데이터 스킵:', hash);
            return;
        }
        
        // 큐 크기 제한
        if (this.queue.length >= this.config.MAX_QUEUE_SIZE) {
            console.warn('⚠️ 큐가 가득 참, 가장 오래된 데이터 제거');
            this.queue.shift();
        }
        
        this.queue.push(position);
        console.log(`📍 위치 큐에 추가: ${this.queue.length}개`);
    }

    /**
     * 배치 전송
     */
    async sendBatch(positions) {
        if (!positions || positions.length === 0) {
            return { success: true, count: 0 };
        }

        console.log(`📤 배치 전송 시작: ${positions.length}개`);
        
        for (let attempt = 1; attempt <= this.config.RETRY_COUNT; attempt++) {
            try {
                // 단일 위치 데이터 전송 (배치가 아닌 개별 호출)
                let successCount = 0;
                let lastError = null;

                for (const pos of positions) {
                    try {
                        const response = await fetch(`${this.apiUrl}/rest/v1/rpc/ah_save_position_history`, {
                            method: 'POST',
                            headers: this.headers,
                            body: JSON.stringify({
                                p_device_id: pos.DEVICE_ID || 'DJI_DEVICE_001',
                                p_latitude: pos.LATITUDE,
                                p_longitude: pos.LONGITUDE,
                                p_altitude: pos.ALTITUDE || 0,
                                p_speed: pos.SPEED || 0,
                                p_heading: pos.AZIMUTH || 0,
                                p_battery_level: pos.BATTERY_LEVEL || null,
                                p_timestamp: pos.TIME || pos.timestamp || null,
                                p_metadata: {
                                    tilt: pos.TILT,
                                    roll: pos.ROLL,
                                    vertical_speed: pos.VERTICAL_SPEED,
                                    horizontal_speed: pos.HORIZONTAL_SPEED,
                                    satellite_count: pos.SATELLITE_COUNT,
                                    gps_signal_level: pos.GPS_SIGNAL_LEVEL,
                                    is_gps_valid: pos.IS_GPS_VALID,
                                    battery_temperature: pos.BATTERY_TEMPERATURE,
                                    battery_voltage: pos.BATTERY_VOLTAGE,
                                    is_charging: pos.IS_CHARGING,
                                    data_source: pos.DATA_SOURCE,
                                    sdk_version: pos.SDK_VERSION,
                                    data_quality: pos.DATA_QUALITY,
                                    address: pos.ADDRESS,
                                    flight_mode: pos.FLIGHT_MODE
                                }
                            })
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`API 응답 오류: ${response.status} - ${errorText}`);
                        }

                        const result = await response.json();
                        successCount++;
                        console.log(`✅ 위치 데이터 전송 성공:`, result);

                    } catch (error) {
                        lastError = error.message;
                        console.error(`❌ 위치 데이터 전송 실패:`, error.message);
                        break; // 하나라도 실패하면 중단
                    }
                }

                if (successCount > 0) {
                    // 성공한 위치들 해시 저장
                    positions.slice(0, successCount).forEach(pos => {
                        this.sentHashes.add(this.generatePositionHash(pos));
                    });
                    
                    // 통계 업데이트
                    this.stats.totalSent += successCount;
                    this.stats.lastSentTime = new Date();
                    
                    console.log(`✅ 배치 전송 성공: ${successCount}/${positions.length}개`);
                    return { success: true, count: successCount };
                } else {
                    throw new Error(lastError || '전송 실패');
                }
                
            } catch (error) {
                console.error(`❌ 배치 전송 실패 (시도 ${attempt}/${this.config.RETRY_COUNT}):`, error);
                this.stats.lastError = error.message;
                
                if (attempt < this.config.RETRY_COUNT) {
                    await this.delay(this.config.RETRY_DELAY * attempt);
                } else {
                    this.stats.totalFailed += positions.length;
                    // 실패한 데이터 localStorage 백업
                    this.backupFailedPositions(positions);
                    return { success: false, error: error.message };
                }
            }
        }
    }

    /**
     * 큐 처리
     */
    async processQueue() {
        if (this.sending || this.queue.length === 0) {
            return;
        }

        this.sending = true;
        
        try {
            // 배치 크기만큼 추출
            const batch = this.queue.splice(0, Math.min(this.config.BATCH_SIZE, this.queue.length));
            const result = await this.sendBatch(batch);
            
            if (!result.success) {
                // 실패한 데이터 큐 앞쪽에 다시 추가
                this.queue.unshift(...batch);
            }
        } finally {
            this.sending = false;
        }
    }

    /**
     * 자동 전송 시작
     */
    startAutoSend() {
        if (this.sendTimer) {
            return;
        }

        this.sendTimer = setInterval(async () => {
            await this.processQueue();
        }, this.config.SEND_INTERVAL);
        
        console.log('🚀 위치정보 자동 전송 시작 (간격: ' + this.config.SEND_INTERVAL + 'ms)');
    }

    /**
     * 자동 전송 중지
     */
    stopAutoSend() {
        if (this.sendTimer) {
            clearInterval(this.sendTimer);
            this.sendTimer = null;
            console.log('⏹️ 위치정보 자동 전송 중지');
        }
    }

    /**
     * localStorage에서 위치 이력 마이그레이션
     */
    async migrateFromLocalStorage() {
        console.log('📦 localStorage 마이그레이션 시작...');
        
        try {
            // dronePositionHistory 키에서 데이터 추출
            const history = JSON.parse(localStorage.getItem('dronePositionHistory') || '[]');
            
            if (history.length === 0) {
                console.log('마이그레이션할 데이터가 없습니다.');
                return { success: true, count: 0 };
            }

            console.log(`${history.length}개 위치 데이터 발견`);
            
            // 배치로 나누어 전송
            let totalSent = 0;
            for (let i = 0; i < history.length; i += this.config.BATCH_SIZE) {
                const batch = history.slice(i, i + this.config.BATCH_SIZE);
                const result = await this.sendBatch(batch);
                
                if (result.success) {
                    totalSent += result.count;
                    console.log(`진행률: ${totalSent}/${history.length}`);
                } else {
                    console.error('배치 전송 실패, 마이그레이션 중단');
                    break;
                }
            }

            // 성공적으로 전송된 데이터 삭제
            if (totalSent === history.length) {
                localStorage.removeItem('dronePositionHistory');
                console.log('✅ 모든 데이터 마이그레이션 완료, localStorage 정리됨');
            }

            return { success: true, count: totalSent };
            
        } catch (error) {
            console.error('마이그레이션 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 로그 파일에서 마이그레이션
     */
    async migrateFromLogs(logPath) {
        console.log('📁 로그 파일 마이그레이션:', logPath);
        
        try {
            // 서버 API를 통해 로그 파일 읽기
            const response = await fetch(`/api/position/read-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logPath })
            });

            if (!response.ok) {
                throw new Error(`로그 파일 읽기 실패: ${response.status}`);
            }

            const positions = await response.json();
            console.log(`${positions.length}개 위치 데이터 파싱됨`);

            // 배치 전송
            const result = await this.sendBatch(positions);
            
            return result;
            
        } catch (error) {
            console.error('로그 파일 마이그레이션 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 실패한 위치 데이터 백업
     */
    backupFailedPositions(positions) {
        try {
            const backup = JSON.parse(localStorage.getItem('failedPositions') || '[]');
            backup.push(...positions);
            
            // 최대 1000개까지만 보관
            if (backup.length > 1000) {
                backup.splice(0, backup.length - 1000);
            }
            
            localStorage.setItem('failedPositions', JSON.stringify(backup));
            console.log(`💾 ${positions.length}개 실패 데이터 백업됨`);
        } catch (error) {
            console.error('백업 실패:', error);
        }
    }

    /**
     * 실패한 데이터 재전송
     */
    async retryFailedPositions() {
        const backup = JSON.parse(localStorage.getItem('failedPositions') || '[]');
        if (backup.length === 0) {
            console.log('재전송할 데이터가 없습니다.');
            return { success: true, count: 0 };
        }

        console.log(`📤 ${backup.length}개 실패 데이터 재전송 시작`);
        
        const result = await this.sendBatch(backup);
        if (result.success) {
            localStorage.removeItem('failedPositions');
            console.log('✅ 재전송 완료');
        }
        
        return result;
    }

    /**
     * 통계 조회
     */
    getStats() {
        return {
            ...this.stats,
            queueSize: this.queue.length,
            hashCacheSize: this.sentHashes.size,
            isAutoSending: !!this.sendTimer
        };
    }

    /**
     * 지연 함수
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 정리
     */
    cleanup() {
        this.stopAutoSend();
        this.queue = [];
        this.sentHashes.clear();
        console.log('🧹 Position API Client 정리 완료');
    }
}

// 전역 인스턴스 생성
window.positionAPI = new PositionAPIClient();

// 페이지 언로드 시 남은 데이터 전송
window.addEventListener('beforeunload', async (e) => {
    if (window.positionAPI && window.positionAPI.queue.length > 0) {
        e.preventDefault();
        await window.positionAPI.processQueue();
    }
});

console.log('📍 Position API Client 초기화 완료');