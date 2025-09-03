// GZONESOFT 스트림 시청 페이지 JavaScript

class StreamViewer {
    constructor() {
        this.currentStreamKey = null;
        this.hls = null;
        this.timeUpdateInterval = null;
        this.dataOverlayInterval = null;
        this.serviceName = 'GZONESOFT LIVE';
        this.lastDataHash = null;
        this.init();
    }
    
    init() {
        // URL에서 스트림 키 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const streamKey = urlParams.get('key');
        
        if (streamKey) {
            document.getElementById('streamKeyInput').value = streamKey;
            this.startViewing(streamKey);
        }
    }
    
    startViewing(streamKey = null) {
        if (!streamKey) {
            streamKey = document.getElementById('streamKeyInput').value.trim();
        }
        
        if (!streamKey) {
            this.showAlert('스트림 키를 입력해주세요.', 'warning');
            return;
        }
        
        this.currentStreamKey = streamKey;
        this.loadStream(streamKey);
        
        // URL 업데이트 (뒤로가기 지원)
        const newUrl = `${window.location.pathname}?key=${streamKey}`;
        window.history.pushState({streamKey}, '', newUrl);
    }
    
    loadStream(streamKey) {
        // webPlayer 또는 다른 플레이어 컨테이너 찾기
        let webPlayer = document.getElementById('webPlayer');
        if (!webPlayer) {
            webPlayer = document.getElementById('simpleWebPlayer');
        }
        if (!webPlayer) {
            webPlayer = document.querySelector('.ratio.ratio-16x9');
        }
        
        if (!webPlayer) {
            console.error('플레이어 컨테이너를 찾을 수 없습니다');
            this.showAlert('플레이어를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const flvUrl = `https://ai.gzonesoft.com:18002/live/${streamKey}.flv`;
        
        // 기존 HLS 정리
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        
        // 기존 오버레이 업데이트 중지
        this.stopOverlayUpdate();
        this.stopDataOverlayUpdate();
        
        // 로딩 표시
        webPlayer.innerHTML = `
            <div class="text-white text-center">
                <div class="spinner-border mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5>FLV 스트림을 로딩중입니다...</h5>
                <p>스트림 키: <strong>${streamKey}</strong></p>
            </div>
        `;
        
        // FLV 스트림으로 직접 시도 (node-media-server 기본 지원)
        this.loadFLVStream(streamKey, flvUrl, webPlayer);
    }
    
    tryFLVFirst(streamKey, flvUrl, webPlayer) {
        // FLV 스트림 존재 확인
        fetch(flvUrl, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    this.loadFLVStream(streamKey, flvUrl, webPlayer);
                } else {
                    throw new Error('FLV stream not available');
                }
            })
            .catch(error => {
                console.log('FLV not available, trying HLS...', error);
                this.tryHLSStream(streamKey, webPlayer);
            });
    }
    
    loadFLVStream(streamKey, flvUrl, webPlayer) {
        // FLV.js 지원 확인
        if (flvjs && flvjs.isSupported()) {
            const videoContainer = this.createVideoContainer();
            const video = videoContainer.querySelector('video');
            
            webPlayer.innerHTML = '';
            webPlayer.appendChild(videoContainer);
            
            // FLV.js 플레이어 생성
            const flvPlayer = flvjs.createPlayer({
                type: 'flv',
                url: flvUrl,
                isLive: true
            }, {
                enableWorker: false,
                enableStashBuffer: false,
                stashInitialSize: 128,
                isLive: true,
                lazyLoad: false,
                lazyLoadMaxDuration: 3 * 60,
                seekType: 'range'
            });
            
            flvPlayer.attachMediaElement(video);
            
            flvPlayer.on(flvjs.Events.LOADING_COMPLETE, () => {
                console.log('FLV.js loading complete');
            });
            
            flvPlayer.on(flvjs.Events.LOADED_METADATA, () => {
                console.log('FLV.js metadata loaded');
                video.muted = false;
                this.startOverlayUpdate(videoContainer);
                this.startDataOverlayUpdate(videoContainer);
                this.showAlert('FLV 스트림이 시작되었습니다!', 'success');
            });
            
            flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
                console.error('FLV.js Error:', errorType, errorDetail);
                this.stopOverlayUpdate();
                this.stopDataOverlayUpdate();
                this.fallbackToNativeFLV(streamKey, flvUrl, webPlayer);
            });
            
            try {
                flvPlayer.load();
                flvPlayer.play();
            } catch (error) {
                console.error('FLV.js failed to start:', error);
                this.stopOverlayUpdate();
                this.stopDataOverlayUpdate();
                this.fallbackToNativeFLV(streamKey, flvUrl, webPlayer);
            }
            
        } else {
            // FLV.js 미지원시 네이티브 시도
            this.fallbackToNativeFLV(streamKey, flvUrl, webPlayer);
        }
    }
    
    fallbackToNativeFLV(streamKey, flvUrl, webPlayer) {
        // HTML5 video로 FLV 시도 (일부 브라우저에서 작동)
        const videoContainer = this.createVideoContainer();
        const video = videoContainer.querySelector('video');
        video.src = flvUrl;
        
        webPlayer.innerHTML = '';
        webPlayer.appendChild(videoContainer);
        
        video.addEventListener('loadstart', () => {
            console.log('Native FLV loading...');
        });
        
        video.addEventListener('canplay', () => {
            console.log('Native FLV ready');
            video.muted = false;
            this.startOverlayUpdate(videoContainer);
            this.startDataOverlayUpdate(videoContainer);
            this.showAlert('네이티브 FLV 스트림이 시작되었습니다!', 'success');
        });
        
        video.addEventListener('error', (e) => {
            console.error('Native FLV Error:', e);
            this.stopOverlayUpdate();
            this.stopDataOverlayUpdate();
            this.handleStreamError(streamKey, flvUrl, '브라우저에서 FLV 재생을 지원하지 않습니다.');
        });
        
        // 5초 후에도 재생이 안되면 오류 처리
        setTimeout(() => {
            if (video.readyState === 0) {
                this.stopOverlayUpdate();
                this.stopDataOverlayUpdate();
                this.handleStreamError(streamKey, flvUrl, 'FLV 스트림 로딩 타임아웃');
            }
        }, 5000);
    }
    
    tryHLSStream(streamKey, webPlayer) {
        const hlsUrl = `http://ai.gzonesoft.com:18001/live/${streamKey}/index.m3u8`;
        
        if (Hls.isSupported()) {
            this.hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            
            const videoContainer = this.createVideoContainer();
            const video = videoContainer.querySelector('video');
            
            webPlayer.innerHTML = '';
            webPlayer.appendChild(videoContainer);
            
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS Stream loaded successfully');
                video.muted = false;
                this.startOverlayUpdate(videoContainer);
                this.startDataOverlayUpdate(videoContainer);
                this.showAlert('HLS 스트림이 시작되었습니다!', 'success');
            });
            
            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    this.stopOverlayUpdate();
                    this.stopDataOverlayUpdate();
                    this.handleStreamError(streamKey, `http://ai.gzonesoft.com:18001/live/${streamKey}.flv`);
                }
            });
            
            this.hls.loadSource(hlsUrl);
            this.hls.attachMedia(video);
            
        } else {
            this.handleStreamError(streamKey, `http://ai.gzonesoft.com:18001/live/${streamKey}.flv`, 'HLS를 지원하지 않는 브라우저입니다.');
        }
    }
    
    handleStreamError(streamKey, flvUrl, message = '스트림 연결에 실패했습니다.') {
        // webPlayer 또는 다른 플레이어 컨테이너 찾기
        let webPlayer = document.getElementById('webPlayer');
        if (!webPlayer) {
            webPlayer = document.getElementById('simpleWebPlayer');
        }
        if (!webPlayer) {
            webPlayer = document.querySelector('.ratio.ratio-16x9');
        }
        
        if (!webPlayer) {
            console.error('플레이어 컨테이너를 찾을 수 없습니다');
            return;
        }
        
        webPlayer.innerHTML = `
            <div class="text-white text-center p-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                <h5>${message}</h5>
                <p class="mb-3">다른 방법으로 시청해보세요:</p>
                
                <div class="d-grid gap-2 d-md-block">
                    <button class="btn btn-primary" onclick="streamViewer.retryStream()">
                        <i class="fas fa-redo me-2"></i>다시 시도
                    </button>
                    <button class="btn btn-outline-light" onclick="streamViewer.copyFLVUrl('${flvUrl}')">
                        <i class="fas fa-copy me-2"></i>FLV URL 복사
                    </button>
                    <button class="btn btn-outline-light" onclick="showVLCGuide()">
                        <i class="fas fa-play-circle me-2"></i>VLC 가이드
                    </button>
                </div>
                
                <div class="mt-3">
                    <small class="text-muted">
                        스트림이 활성 상태인지 확인하거나, VLC 등의 외부 플레이어를 사용해주세요.
                    </small>
                </div>
            </div>
        `;
        
        this.showAlert('웹 플레이어 연결 실패. 다른 방법을 시도해주세요.', 'warning');
    }
    
    // 비디오 컨테이너 생성 (오버레이 포함)
    createVideoContainer() {
        const container = document.createElement('div');
        container.className = 'video-container w-100 h-100';
        
        const video = document.createElement('video');
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        video.className = 'w-100 h-100';
        video.style.objectFit = 'contain';
        
        // 서비스 이름 오버레이
        const serviceOverlay = document.createElement('div');
        serviceOverlay.className = 'video-overlay overlay-service-name overlay-fade-in';
        serviceOverlay.textContent = this.serviceName;
        
        // 시간 오버레이
        const timeOverlay = document.createElement('div');
        timeOverlay.className = 'video-overlay overlay-time overlay-fade-in';
        timeOverlay.innerHTML = `
            <div class="overlay-current-time">--:--:--</div>
            <div class="overlay-date">----년 --월 --일</div>
        `;
        
        // 데이터 오버레이
        const dataOverlay = document.createElement('div');
        dataOverlay.className = 'video-overlay overlay-data overlay-fade-in';
        dataOverlay.innerHTML = `
            <div class="data-row">
                <span class="data-label">위도:</span>
                <span class="data-value" data-field="LATITUDE">--</span>
            </div>
            <div class="data-row">
                <span class="data-label">경도:</span>
                <span class="data-value" data-field="LONGITUDE">--</span>
            </div>
            <div class="data-row">
                <span class="data-label">고도:</span>
                <span class="data-value" data-field="ALTITUDE">-- m</span>
            </div>
            <div class="data-row">
                <span class="data-label">속도:</span>
                <span class="data-value" data-field="SPEED">-- m/s</span>
            </div>
            <div class="data-row">
                <span class="data-label">방위각:</span>
                <span class="data-value" data-field="AZIMUTH">--°</span>
            </div>
            <div class="data-row">
                <span class="data-label">틸트:</span>
                <span class="data-value" data-field="TILT">--°</span>
            </div>
            <div class="data-row">
                <span class="data-label">롤:</span>
                <span class="data-value" data-field="ROLL">--°</span>
            </div>
        `;
        
        container.appendChild(video);
        container.appendChild(serviceOverlay);
        container.appendChild(timeOverlay);
        container.appendChild(dataOverlay);
        
        return container;
    }
    
    // 오버레이 시간 업데이트 시작
    startOverlayUpdate(container) {
        this.stopOverlayUpdate(); // 기존 인터벌 정리
        
        const timeOverlay = container.querySelector('.overlay-time');
        if (!timeOverlay) {
            console.error('❌ 시간 오버레이 요소를 찾을 수 없습니다');
            return;
        }
        
        console.log('✅ 시간 오버레이 업데이트 시작'); // 디버깅용 로그
        
        this.timeUpdateInterval = setInterval(() => {
            console.log('⏰ 시간 오버레이 업데이트 시도 중...', new Date().toLocaleTimeString());
            this.updateTimeOverlay(timeOverlay);
        }, 1000);
        
        // 즉시 한 번 업데이트
        console.log('⚡ 초기 시간 오버레이 업데이트 실행');
        this.updateTimeOverlay(timeOverlay);
    }
    
    // 오버레이 시간 업데이트 중지
    stopOverlayUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }
    
    // 데이터 오버레이 업데이트 시작
    startDataOverlayUpdate(container) {
        this.stopDataOverlayUpdate(); // 기존 인터벌 정리
        
        const dataOverlay = container.querySelector('.overlay-data');
        if (!dataOverlay) {
            console.error('❌ 데이터 오버레이 요소를 찾을 수 없습니다');
            return;
        }
        
        console.log('✅ 데이터 오버레이 업데이트 시작'); // 디버깅용 로그
        
        this.dataOverlayInterval = setInterval(() => {
            console.log('🔄 데이터 오버레이 업데이트 시도 중...', new Date().toLocaleTimeString());
            this.updateDataOverlay(dataOverlay);
        }, 1000);
        
        // 즉시 한 번 업데이트
        console.log('⚡ 초기 데이터 오버레이 업데이트 실행');
        this.updateDataOverlay(dataOverlay);
    }
    
    // 데이터 오버레이 업데이트 중지
    stopDataOverlayUpdate() {
        if (this.dataOverlayInterval) {
            clearInterval(this.dataOverlayInterval);
            this.dataOverlayInterval = null;
        }
    }
    
    // 데이터 오버레이 업데이트
    async updateDataOverlay(dataOverlay) {
        if (!dataOverlay) {
            console.error('❌ dataOverlay가 존재하지 않습니다');
            return;
        }
        
        console.log('📡 API 호출 시작: /api/overlay-data');
        
        try {
            // 서버에서 데이터 가져오기
            const response = await fetch('https://ai.gzonesoft.com:17937/api/overlay-data', {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('📡 API 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                console.error('❌ 오버레이 데이터 API 호출 실패:', response.status, response.statusText);
                // 오류 상태를 오버레이에 표시
                this.showDataOverlayError(dataOverlay, `API Error: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            console.log('📊 받은 데이터:', data);
            
            // 데이터 변경 감지 (성능 최적화)
            const currentDataHash = JSON.stringify(data);
            if (currentDataHash === this.lastDataHash) {
                console.log('📊 데이터 변경없음 - 업데이트 생략');
                return; // 데이터 변경없음
            }
            this.lastDataHash = currentDataHash;
            
            console.log('🔄 DOM 업데이트 시작');
            
            // 각 데이터 필드 업데이트
            const fields = ['LATITUDE', 'LONGITUDE', 'ALTITUDE', 'SPEED', 'AZIMUTH', 'TILT', 'ROLL'];
            let updatedCount = 0;
            
            fields.forEach(field => {
                const valueElement = dataOverlay.querySelector(`[data-field="${field}"]`);
                if (valueElement && data[field] !== undefined) {
                    let formattedValue = data[field];
                    
                    // 데이터 포맷팅
                    switch(field) {
                        case 'LATITUDE':
                        case 'LONGITUDE':
                            formattedValue = parseFloat(data[field]).toFixed(6);
                            break;
                        case 'ALTITUDE':
                            formattedValue = parseFloat(data[field]).toFixed(1) + ' m';
                            break;
                        case 'SPEED':
                            formattedValue = parseFloat(data[field]).toFixed(1) + ' m/s';
                            break;
                        case 'AZIMUTH':
                        case 'TILT':
                        case 'ROLL':
                            formattedValue = parseFloat(data[field]).toFixed(1) + '°';
                            break;
                    }
                    
                    const oldValue = valueElement.textContent;
                    valueElement.textContent = formattedValue;
                    console.log(`📝 ${field}: "${oldValue}" -> "${formattedValue}"`);
                    updatedCount++;
                } else {
                    console.warn(`⚠️  필드 "${field}"를 위한 요소를 찾을 수 없거나 데이터가 없습니다`);
                }
            });
            
            console.log(`✅ 데이터 오버레이 업데이트 완료: ${updatedCount}개 필드 업데이트, 시간: ${new Date().toLocaleTimeString()}`);
            
            // 성공 표시 (오버레이에 녹색 테두리 잠깐 표시)
            dataOverlay.style.borderColor = '#28a745';
            setTimeout(() => {
                dataOverlay.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            }, 200);
            
        } catch (error) {
            console.error('❌ 데이터 오버레이 업데이트 오류:', error);
            this.showDataOverlayError(dataOverlay, 'Network Error');
        }
    }
    
    // 데이터 오버레이 에러 표시
    showDataOverlayError(dataOverlay, errorMessage) {
        // 에러 상태 표시 (빨간 테두리)
        dataOverlay.style.borderColor = '#dc3545';
        
        // 에러 메시지를 마지막 행에 표시
        let errorRow = dataOverlay.querySelector('.error-row');
        if (!errorRow) {
            errorRow = document.createElement('div');
            errorRow.className = 'data-row error-row';
            errorRow.style.color = '#dc3545';
            errorRow.style.fontSize = '0.8em';
            dataOverlay.appendChild(errorRow);
        }
        
        errorRow.innerHTML = `<span class="data-label">상태:</span><span class="data-value">${errorMessage}</span>`;
        
        // 3초 후 에러 표시 제거
        setTimeout(() => {
            if (errorRow && errorRow.parentElement) {
                errorRow.remove();
            }
            dataOverlay.style.borderColor = 'rgba(0, 0, 0, 0.1)';
        }, 3000);
    }
    
    // 시간 오버레이 업데이트
    updateTimeOverlay(timeOverlay) {
        if (!timeOverlay) {
            console.warn('❌ timeOverlay가 존재하지 않습니다');
            return;
        }
        
        const now = new Date();
        
        // 현재 시간 포맷팅 (24시간 형식)
        const timeString = now.toLocaleTimeString('ko-KR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 현재 날짜 포맷팅
        const dateString = now.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
        
        const timeElement = timeOverlay.querySelector('.overlay-current-time');
        const dateElement = timeOverlay.querySelector('.overlay-date');
        
        if (timeElement) {
            timeElement.textContent = timeString;
            console.log('⏰ 시간 업데이트:', timeString); // 디버깅용 로그
        } else {
            console.warn('⚠️  시간 요소를 찾을 수 없습니다');
        }
        
        if (dateElement) {
            dateElement.textContent = dateString;
            console.log('📅 날짜 업데이트:', dateString); // 디버깅용 로그
        } else {
            console.warn('⚠️  날짜 요소를 찾을 수 없습니다');
        }
    }
    
    // 서비스 이름 설정
    setServiceName(name) {
        this.serviceName = name || 'GZONESOFT LIVE';
        
        // 현재 표시 중인 오버레이도 업데이트
        const serviceOverlay = document.querySelector('.overlay-service-name');
        if (serviceOverlay) {
            serviceOverlay.textContent = this.serviceName;
        }
    }
    
    retryStream() {
        if (this.currentStreamKey) {
            this.loadStream(this.currentStreamKey);
        }
    }
    
    async copyFLVUrl(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showAlert('FLV URL이 복사되었습니다!', 'success');
        } catch (error) {
            console.error('Failed to copy URL:', error);
            this.showAlert('URL 복사에 실패했습니다.', 'error');
        }
    }
    
    showAlert(message, type) {
        // 기존 알림 제거
        const existingAlert = document.querySelector('.floating-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // 새 알림 생성
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} floating-alert`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        alertDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 3000);
    }
}

// 전역 함수들
let streamViewer;

// 페이지 로드시 초기화
document.addEventListener('DOMContentLoaded', () => {
    streamViewer = new StreamViewer();
});

// 시청 시작
function startViewing() {
    streamViewer.startViewing();
}

// 가이드 모달 표시
function showVLCGuide() {
    const modal = new bootstrap.Modal(document.getElementById('vlcGuideModal'));
    modal.show();
}

function showOBSGuide() {
    const modal = new bootstrap.Modal(document.getElementById('obsGuideModal'));
    modal.show();
}

// VLC URL 복사
function copyVLCUrl() {
    const streamKey = document.getElementById('streamKeyInput').value.trim();
    if (!streamKey) {
        streamViewer.showAlert('먼저 스트림 키를 입력해주세요.', 'warning');
        return;
    }
    
    const vlcUrl = `http://ai.gzonesoft.com:18001/live/${streamKey}.flv`;
    streamViewer.copyFLVUrl(vlcUrl);
}

// 키보드 이벤트
document.addEventListener('keydown', (event) => {
    // Enter: 스트림 시청 시작
    if (event.key === 'Enter' && event.target.id === 'streamKeyInput') {
        startViewing();
    }
    
    // ESC: 전체화면 종료
    if (event.key === 'Escape') {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }
});

// 뒤로가기/앞으로가기 지원
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.streamKey) {
        document.getElementById('streamKeyInput').value = event.state.streamKey;
        streamViewer.startViewing(event.state.streamKey);
    }
});

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    if (streamViewer) {
        if (streamViewer.hls) {
            streamViewer.hls.destroy();
        }
        streamViewer.stopOverlayUpdate();
        streamViewer.stopDataOverlayUpdate();
    }
});

// 전역 오버레이 업데이트 함수 (백업용)
function startGlobalOverlayUpdate() {
    // 모든 페이지의 오버레이 요소들을 찾아서 업데이트
    setInterval(() => {
        const timeOverlays = document.querySelectorAll('.overlay-time');
        timeOverlays.forEach(timeOverlay => {
            if (timeOverlay && timeOverlay.style.display !== 'none') {
                updateGlobalTimeOverlay(timeOverlay);
            }
        });
    }, 1000);
}

function updateGlobalTimeOverlay(timeOverlay) {
    const now = new Date();
    
    const timeString = now.toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const dateString = now.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
    
    const timeElement = timeOverlay.querySelector('.overlay-current-time');
    const dateElement = timeOverlay.querySelector('.overlay-date');
    
    if (timeElement) {
        timeElement.textContent = timeString;
    }
    
    if (dateElement) {
        dateElement.textContent = dateString;
    }
}

// 페이지 로드 후 전역 업데이트 시작
document.addEventListener('DOMContentLoaded', () => {
    // 3초 후에 전역 오버레이 업데이트 시작 (인스턴스별 업데이트와 충돌 방지)
    setTimeout(() => {
        const hasActiveOverlays = document.querySelectorAll('.overlay-time').length > 0;
        if (hasActiveOverlays) {
            console.log('전역 오버레이 업데이트 시작');
            startGlobalOverlayUpdate();
        }
    }, 3000);
});

// 오버레이 설정 함수들 (전역)
function setServiceName() {
    const name = prompt('서비스 이름을 입력하세요:', streamViewer.serviceName);
    if (name !== null) {
        streamViewer.setServiceName(name);
        streamViewer.showAlert('서비스 이름이 변경되었습니다!', 'success');
    }
}
