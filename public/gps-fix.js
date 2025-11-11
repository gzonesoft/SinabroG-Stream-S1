// GPS 좌표 강제 표시 스크립트
// 브라우저 콘솔에서 실행하거나 HTML에 포함

class GPSOverlayFix {
    constructor() {
        this.updateInterval = null;
        this.init();
    }
    
    init() {
        console.log('🔧 GPS 오버레이 수정 스크립트 시작');
        this.startGPSUpdate();
    }
    
    async startGPSUpdate() {
        // 기존 인터벌 정리
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // 1초마다 GPS 데이터 업데이트
        this.updateInterval = setInterval(async () => {
            await this.updateGPSData();
        }, 1000);
        
        // 즉시 한 번 실행
        await this.updateGPSData();
    }
    
    async updateGPSData() {
        try {
            // API에서 데이터 가져오기
            const timestamp = Date.now();
            const response = await fetch(`/api/overlay-data?_t=${timestamp}`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // 오버레이 요소 찾기
            const overlay = document.querySelector('.overlay-data');
            if (!overlay) {
                console.warn('⚠️ 오버레이 요소를 찾을 수 없습니다');
                return;
            }
            
            // GPS 데이터 업데이트
            this.updateField(overlay, 'LATITUDE', data.LATITUDE, '6');
            this.updateField(overlay, 'LONGITUDE', data.LONGITUDE, '6');
            this.updateField(overlay, 'ALTITUDE', data.ALTITUDE, '1', ' m');
            this.updateField(overlay, 'SPEED', data.SPEED, '1', ' m/s');
            this.updateField(overlay, 'AZIMUTH', data.AZIMUTH, '1', '°');
            this.updateField(overlay, 'TILT', data.TILT, '1', '°');
            this.updateField(overlay, 'ROLL', data.ROLL, '1', '°');
            
            // 성공 표시
            overlay.style.borderColor = '#28a745';
            setTimeout(() => {
                overlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }, 200);
            
        } catch (error) {
            console.error('❌ GPS 데이터 업데이트 실패:', error);
            
            // 에러 표시
            const overlay = document.querySelector('.overlay-data');
            if (overlay) {
                overlay.style.borderColor = '#dc3545';
                setTimeout(() => {
                    overlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }, 1000);
            }
        }
    }
    
    updateField(overlay, fieldName, value, precision, suffix = '') {
        const element = overlay.querySelector(`[data-field="${fieldName}"]`);
        if (element && value !== undefined && value !== null) {
            const formattedValue = parseFloat(value).toFixed(precision) + suffix;
            const oldValue = element.textContent;
            
            if (oldValue !== formattedValue) {
                element.textContent = formattedValue;
                
                // 시각적 효과
                element.style.backgroundColor = 'rgba(40, 167, 69, 0.3)';
                element.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    element.style.backgroundColor = 'transparent';
                }, 1000);
                
                console.log(`✅ ${fieldName}: ${oldValue} → ${formattedValue}`);
            }
        } else if (!element) {
            console.error(`❌ ${fieldName} 요소를 찾을 수 없습니다`);
        } else {
            console.warn(`⚠️ ${fieldName} 데이터가 없습니다:`, value);
        }
    }
    
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('⏹️ GPS 업데이트 중지됨');
        }
    }
}

// 전역 변수로 생성
window.gpsFix = new GPSOverlayFix();

console.log('🎯 GPS 수정 스크립트 로드 완료!');
console.log('📝 사용법:');
console.log('  - window.gpsFix.stop() : 업데이트 중지');
console.log('  - window.gpsFix.startGPSUpdate() : 업데이트 재시작');
