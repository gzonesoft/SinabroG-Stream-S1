// GZONESOFT 스트림 시청 페이지 JavaScript

class StreamViewer {
    constructor() {
        this.currentStreamKey = null;
        this.hls = null;
        this.timeUpdateInterval = null;
        this.dataOverlayInterval = null;
        this.serviceName = 'AHSYSTEM Live';
        this.lastDataHash = null;
        this.debugMode = false;
        this.autoCapture = false;
        this.autoCaptureInterval = null;
        this.recentCaptures = [];
        this.maxRecentCaptures = 3; // 최대 3개까지 표시
        this.init();
    }
    
    init() {
        // URL에서 스트림 키 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const streamKey = urlParams.get('key');
        const autoCapture = urlParams.get('autoCapture') === 'true';
        
        if (streamKey) {
            document.getElementById('streamKeyInput').value = streamKey;
            this.startViewing(streamKey);
            
            // 자동 캡처 요청시
            if (autoCapture) {
                setTimeout(() => {
                    this.autoCaptureAfterLoad();
                }, 3000); // 3초 후 자동 캡처
            }
        }
        
        // 초기 캡처 목록 로드
        this.updateCaptureCount();
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
                console.log('FLV not available:', error);
                this.handleStreamError(streamKey, flvUrl, 'FLV 스트림을 사용할 수 없습니다.');
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
                this.showCaptureButton();
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
                
                // 스트림 로드 즉시 오버레이 업데이트 시작 (LOADED_METADATA 이벤트를 기다리지 않음)
                console.log('🚀 FLV 스트림 로드됨 - 강제로 오버레이 업데이트 시작');
                console.log('📦 videoContainer:', videoContainer);
                this.startOverlayUpdate(videoContainer);
                this.startDataOverlayUpdate(videoContainer);
                
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
        
        // Native FLV 로드 즉시 오버레이 업데이트 시작
        console.log('🚀 Native FLV 로드됨 - 강제로 오버레이 업데이트 시작');
        this.startOverlayUpdate(videoContainer);
        this.startDataOverlayUpdate(videoContainer);
        
        video.addEventListener('loadstart', () => {
            console.log('Native FLV loading...');
        });
        
        video.addEventListener('canplay', () => {
            console.log('Native FLV ready');
            video.muted = false;
            this.startOverlayUpdate(videoContainer);
            this.startDataOverlayUpdate(videoContainer);
            this.showAlert('네이티브 FLV 스트림이 시작되었습니다!', 'success');
            this.showCaptureButton();
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
    
    handleStreamError(streamKey, flvUrl, message = '스트림 연결에 실패했습니다.') {
        // HLS 시도 제거 - FLV만 사용하므로 바로 에러 처리
        console.error('스트림 에러:', message);
        
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
        console.log('🟩 startOverlayUpdate 호출됨!', container);
        
        this.stopOverlayUpdate(); // 기존 인터벌 정리
        
        const timeOverlay = container.querySelector('.overlay-time');
        console.log('🔍 시간 오버레이 요소 검색 결과:', timeOverlay);
        
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
        console.log('🟦 startDataOverlayUpdate 호출됨!', container);
        
        this.stopDataOverlayUpdate(); // 기존 인터벌 정리
        
        const dataOverlay = container.querySelector('.overlay-data');
        console.log('🔍 데이터 오버레이 요소 검색 결과:', dataOverlay);
        
        if (!dataOverlay) {
            console.error('❌ 데이터 오버레이 요소를 찾을 수 없습니다');
            console.log('📋 container 내부 HTML:', container.innerHTML);
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
        
        const currentTime = new Date().toLocaleTimeString();
        console.log(`📡 [${currentTime}] API 호출 시작: /api/overlay-data`);
        
        try {
            // 서버에서 데이터 가져오기 - 캐시 방지를 위한 타임스탬프 추가
            const timestamp = Date.now();
            
            // 현재 프로토콜에 맞는 API URL 생성
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = protocol === 'https:' ? '17937' : '17936';
            const apiUrl = `${protocol}//${hostname}:${port}/api/overlay-data?_t=${timestamp}`;
            
            console.log(`📡 [${new Date().toLocaleTimeString()}] API URL: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            console.log(`📡 [${currentTime}] API 응답 상태:`, response.status, response.statusText);
            
            if (!response.ok) {
                console.error('❌ 오버레이 데이터 API 호출 실패:', response.status, response.statusText);
                // 오류 상태를 오버레이에 표시
                this.showDataOverlayError(dataOverlay, `API Error: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            console.log(`📊 [${currentTime}] 받은 데이터:`, data);
            
            // 데이터 변경 감지 (성능 최적화)
            const currentDataHash = JSON.stringify(data);
            if (currentDataHash === this.lastDataHash) {
                console.log(`📊 [${currentTime}] 데이터 변경없음 - 업데이트 생략`);
                return; // 데이터 변경없음
            }
            
            console.log(`🔄 [${currentTime}] 데이터 변경감지 - DOM 업데이트 시작`);
            this.lastDataHash = currentDataHash;
            
            // 각 데이터 필드 업데이트
            const fields = ['LATITUDE', 'LONGITUDE', 'ALTITUDE', 'SPEED', 'AZIMUTH', 'TILT', 'ROLL'];
            let updatedCount = 0;
            
            fields.forEach(field => {
                const valueElement = dataOverlay.querySelector(`[data-field="${field}"]`);
                console.log(`🔍 [${currentTime}] 필드 "${field}" 검색:`, valueElement ? '찾음' : '없음');
                
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
                    
                    // CSS 클래스로 값 변경 표시 (선택사항)
                    if (oldValue !== formattedValue) {
                        valueElement.classList.add('data-updated');
                        setTimeout(() => {
                            valueElement.classList.remove('data-updated');
                        }, 1000);
                    }
                    
                    // 값이 변경된 경우만 로그 출력
                    if (oldValue !== formattedValue) {
                        console.log(`📝 [${currentTime}] ${field}: "${oldValue}" -> "${formattedValue}"`);
                    }
                    
                    updatedCount++;
                } else if (!valueElement) {
                    console.error(`❌ [${currentTime}] 필드 "${field}"를 위한 DOM 요소를 찾을 수 없습니다`);
                    console.log('📋 현재 dataOverlay DOM:', dataOverlay.innerHTML);
                } else {
                    console.warn(`⚠️  [${currentTime}] 필드 "${field}"에 대한 데이터가 없습니다:`, data[field]);
                }
            });
            
            console.log(`✅ [${currentTime}] 데이터 오버레이 업데이트 완료: ${updatedCount}개 필드 업데이트`);
            console.log('----------------------------------------');
            
            // 성공 표시 (오버레이에 녹색 테두리 잠깐 표시)
            dataOverlay.style.borderColor = '#28a745';
            setTimeout(() => {
                dataOverlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }, 200);
            
        } catch (error) {
            console.error(`❌ [${currentTime}] 데이터 오버레이 업데이트 오류:`, error);
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
            dataOverlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
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
        this.serviceName = name || 'AHSYSTEM Live';
        
        // 현재 표시 중인 오버레이도 업데이트
        const serviceOverlay = document.querySelector('.overlay-service-name');
        if (serviceOverlay) {
            serviceOverlay.textContent = this.serviceName;
        }
    }

    // 캡처 버튼 표시/숨김
    showCaptureButton() {
        const captureBtn = document.getElementById('captureBtn');
        const realTimeCaptureBtn = document.getElementById('realTimeCaptureBtn');
        
        if (captureBtn) {
            // 메인 버튼 활성화 및 스타일 변경
            captureBtn.disabled = false;
            captureBtn.className = 'btn btn-danger btn-lg capture-main-btn';
            captureBtn.title = '화면 캡처';
            captureBtn.querySelector('span').textContent = '촬영하기';
        }
        
        if (realTimeCaptureBtn) {
            // 실시간 캡처 버튼 활성화
            realTimeCaptureBtn.disabled = false;
            realTimeCaptureBtn.title = '오버레이 포함 전체 화면 캡처';
        }
        
        // 스트림 정보 업데이트
        this.updateStreamInfo();
        
        // 캡처 개수 업데이트
        this.updateCaptureCount();
    }

    hideCaptureButton() {
        const captureBtn = document.getElementById('captureBtn');
        const realTimeCaptureBtn = document.getElementById('realTimeCaptureBtn');
        
        if (captureBtn) {
            // 메인 버튼 비활성화 및 스타일 변경
            captureBtn.disabled = true;
            captureBtn.className = 'btn btn-secondary btn-lg capture-main-btn';
            captureBtn.title = '스트림을 먼저 시작하세요';
            captureBtn.querySelector('span').textContent = '스트림 대기중';
        }
        
        if (realTimeCaptureBtn) {
            // 실시간 캡처 버튼 비활성화
            realTimeCaptureBtn.disabled = true;
            realTimeCaptureBtn.title = '스트림을 먼저 시작하세요';
        }
        
        // 스트림 상태 업데이트
        this.updateStreamStatusToWaiting();
    }

    // 캡처 효과 표시 (화면 플래시)
    showCaptureEffect() {
        const flashDiv = document.createElement('div');
        flashDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: white;
            z-index: 99999;
            opacity: 0.8;
            pointer-events: none;
        `;
        
        document.body.appendChild(flashDiv);
        
        // 플래시 효과
        setTimeout(() => {
            flashDiv.style.opacity = '0';
            flashDiv.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                if (flashDiv.parentElement) {
                    flashDiv.remove();
                }
            }, 300);
        }, 50);
    }

    // 스트림 정보 업데이트
    updateStreamInfo() {
        const streamKeyInfo = document.getElementById('streamKeyInfo');
        const streamStatusInfo = document.getElementById('streamStatusInfo');
        const streamTimeInfo = document.getElementById('streamTimeInfo');
        
        if (streamKeyInfo && this.currentStreamKey) {
            streamKeyInfo.textContent = this.currentStreamKey;
        }
        
        if (streamStatusInfo) {
            streamStatusInfo.innerHTML = '<i class="fas fa-circle me-1"></i>LIVE';
            streamStatusInfo.className = 'fw-bold text-success';
        }
        
        if (streamTimeInfo) {
            const now = new Date().toLocaleTimeString('ko-KR');
            streamTimeInfo.textContent = now;
        }
    }

    // 스트림 대기 상태로 업데이트
    updateStreamStatusToWaiting() {
        const streamStatusInfo = document.getElementById('streamStatusInfo');
        
        if (streamStatusInfo) {
            streamStatusInfo.innerHTML = '<i class="fas fa-circle me-1"></i>대기중';
            streamStatusInfo.className = 'fw-bold text-muted';
        }
    }

    // 캡처 개수 업데이트
    updateCaptureCount() {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        const count = captures.length;
        
        // 갤러리 뱃지 업데이트
        const galleryBadge = document.getElementById('galleryBadge');
        if (galleryBadge) {
            if (count > 0) {
                galleryBadge.textContent = count;
                galleryBadge.style.display = 'inline';
            } else {
                galleryBadge.style.display = 'none';
            }
        }
        
        // 기존 갤러리 버튼들도 업데이트 (호환성)
        const galleryButtons = document.querySelectorAll('[onclick*="openCaptureGallery"]');
        galleryButtons.forEach(btn => {
            // 기존 뱃지 제거
            const existingBadge = btn.querySelector('.badge');
            if (existingBadge && !existingBadge.id) {
                existingBadge.remove();
            }
            
            // 새 뱃지 추가 (갤러리 버튼이 별도가 아닌 경우)
            if (count > 0 && !btn.querySelector('#galleryBadge')) {
                const badge = document.createElement('span');
                badge.className = 'badge bg-success ms-1';
                badge.textContent = count;
                btn.appendChild(badge);
            }
        });
        
        // 실시간 캡처 목록 업데이트
        this.updateRecentCaptures();
    }

    // 자동 캡처 상태 업데이트
    updateAutoCaptureStatus() {
        // 자동 캡처 상태는 제거되었으므로 빈 함수로 유지
        console.log('Auto capture status:', this.autoCapture ? 'ON' : 'OFF');
    }

    // 실시간 캡처 목록 업데이트
    updateRecentCaptures() {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        const recentCapturesSection = document.getElementById('recentCapturesSection');
        const recentCapturesContainer = document.getElementById('recentCapturesContainer');
        
        if (!recentCapturesSection || !recentCapturesContainer) {
            return;
        }
        
        // 최근 캡처가 있으면 섹션 표시
        if (captures.length > 0) {
            recentCapturesSection.style.display = 'block';
            
            // 최신 캡처 3개만 표시
            const recentCaptures = captures.slice(0, this.maxRecentCaptures);
            
            // 캡처 목록 렌더링
            recentCapturesContainer.innerHTML = recentCaptures.map((capture, index) => `
                <div class="recent-capture-item" data-capture-id="${capture.id}">
                    <img src="${capture.dataUrl}" 
                         alt="캡처 ${index + 1}" 
                         onclick="streamViewer.viewCaptureDetail('${capture.id}')"
                         title="클릭하여 크게 보기">
                    <div class="recent-capture-info">
                        <p class="capture-time">${this.formatCaptureTime(capture.timestamp)}</p>
                        <p class="capture-id">#${capture.id.substring(8, 16)}</p>
                    </div>
                    <div class="recent-capture-actions">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="streamViewer.downloadCapture('${capture.id}')"
                                title="다운로드">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" 
                                onclick="streamViewer.deleteRecentCapture('${capture.id}')"
                                title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
        } else {
            // 캡처가 없으면 빈 메시지 표시
            recentCapturesContainer.innerHTML = `
                <div class="empty-captures-message">
                    <i class="fas fa-camera-retro d-block"></i>
                    아직 캡처된 사진이 없습니다
                </div>
            `;
        }
    }

    // 캡처 시간 포맷팅
    formatCaptureTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        
        if (diffSeconds < 60) {
            return `${diffSeconds}초 전`;
        } else if (diffMinutes < 60) {
            return `${diffMinutes}분 전`;
        } else if (diffHours < 24) {
            return `${diffHours}시간 전`;
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5);
        }
    }

    // 캡처 상세 보기
    viewCaptureDetail(captureId) {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        const capture = captures.find(c => c.id === captureId);
        
        if (!capture) {
            this.showAlert('캡처를 찾을 수 없습니다.', 'error');
            return;
        }
        
        // 새 창에서 이미지 크게 보기
        const newWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes');
        newWindow.document.write(`
            <html>
            <head>
                <title>스트림 캡처 - ${new Date(capture.timestamp).toLocaleString()}</title>
                <style>
                    body { 
                        margin: 0; padding: 20px; background: #000; color: #fff; 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                    }
                    .header { text-align: center; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: #007bff; }
                    .image-container { 
                        text-align: center; 
                        margin: 20px 0; 
                        border: 2px solid #333; 
                        border-radius: 8px; 
                        overflow: hidden;
                        background: #111;
                    }
                    img { 
                        max-width: 100%; height: auto; display: block; 
                        margin: 0 auto; 
                    }
                    .info-grid { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 20px; 
                        margin: 20px 0; 
                    }
                    .info-section {
                        background: #222;
                        padding: 15px;
                        border-radius: 8px;
                        border: 1px solid #333;
                    }
                    .info-section h3 { 
                        margin: 0 0 10px 0; 
                        color: #28a745; 
                        font-size: 1.1em;
                    }
                    .info-item { 
                        margin: 8px 0; 
                        display: flex; 
                        justify-content: space-between;
                    }
                    .info-label { color: #aaa; font-weight: 500; }
                    .info-value { color: #fff; font-weight: 600; }
                    .button-container { 
                        text-align: center; 
                        margin: 20px 0;
                        display: flex;
                        gap: 10px;
                        justify-content: center;
                    }
                    .download-btn { 
                        background: #007bff; color: white; padding: 12px 24px; 
                        border: none; border-radius: 6px; cursor: pointer; 
                        font-size: 16px; font-weight: 600;
                        transition: all 0.3s ease;
                    }
                    .download-btn:hover { background: #0056b3; transform: translateY(-2px); }
                    .close-btn { 
                        background: #6c757d; color: white; padding: 12px 24px; 
                        border: none; border-radius: 6px; cursor: pointer; 
                        font-size: 16px; font-weight: 600;
                        transition: all 0.3s ease;
                    }
                    .close-btn:hover { background: #545b62; transform: translateY(-2px); }
                    .overlay-info {
                        background: #1a1a2e;
                        border: 1px solid #16213e;
                        color: #eee;
                    }
                    .sensor-data {
                        background: #0f3460;
                        border: 1px solid #16213e;
                        color: #e3f2fd;
                    }
                    @media (max-width: 768px) {
                        .info-grid { grid-template-columns: 1fr; }
                        .button-container { flex-direction: column; align-items: center; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📸 실시간 스트림 캡처</h2>
                    <p>오버레이 포함 전체 화면 캡처</p>
                </div>
                
                <div class="image-container">
                    <img src="${capture.dataUrl}" alt="스트림 캡처 이미지">
                </div>
                
                <div class="info-grid">
                    <div class="info-section">
                        <h3>📋 기본 정보</h3>
                        <div class="info-item">
                            <span class="info-label">스트림 키:</span>
                            <span class="info-value">${capture.streamKey}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">캡처 시간:</span>
                            <span class="info-value">${new Date(capture.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">해상도:</span>
                            <span class="info-value">${capture.width || '알 수 없음'} × ${capture.height || '알 수 없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">캡처 타입:</span>
                            <span class="info-value">${capture.captureType === 'full_overlay' ? '오버레이 포함' : '일반'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">캡처 ID:</span>
                            <span class="info-value">${capture.id.substring(0, 16)}...</span>
                        </div>
                    </div>
                    
                    ${capture.overlayData ? `
                    <div class="info-section overlay-info">
                        <h3>🎯 오버레이 정보</h3>
                        <div class="info-item">
                            <span class="info-label">서비스명:</span>
                            <span class="info-value">${capture.overlayData.serviceName || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">시간:</span>
                            <span class="info-value">${capture.overlayData.time || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">날짜:</span>
                            <span class="info-value">${capture.overlayData.date || '없음'}</span>
                        </div>
                    </div>
                    
                    ${capture.overlayData.sensorData ? `
                    <div class="info-section sensor-data">
                        <h3>📡 센서 데이터</h3>
                        <div class="info-item">
                            <span class="info-label">위도:</span>
                            <span class="info-value">${capture.overlayData.sensorData.LATITUDE || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">경도:</span>
                            <span class="info-value">${capture.overlayData.sensorData.LONGITUDE || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">고도:</span>
                            <span class="info-value">${capture.overlayData.sensorData.ALTITUDE || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">속도:</span>
                            <span class="info-value">${capture.overlayData.sensorData.SPEED || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">방위각:</span>
                            <span class="info-value">${capture.overlayData.sensorData.AZIMUTH || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">틸트:</span>
                            <span class="info-value">${capture.overlayData.sensorData.TILT || '없음'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">롤:</span>
                            <span class="info-value">${capture.overlayData.sensorData.ROLL || '없음'}</span>
                        </div>
                    </div>
                    ` : ''}
                    ` : `
                    <div class="info-section">
                        <h3>ℹ️ 추가 정보</h3>
                        <p style="color: #aaa; font-style: italic;">오버레이 정보가 없는 캡처입니다.</p>
                    </div>
                    `}
                </div>
                
                <div class="button-container">
                    <button class="download-btn" onclick="downloadImage()">
                        📥 다운로드
                    </button>
                    <button class="close-btn" onclick="window.close()">
                        ❌ 닫기
                    </button>
                </div>
                
                <script>
                    function downloadImage() {
                        const link = document.createElement('a');
                        link.download = 'stream-capture-${capture.streamKey}-${new Date(capture.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.png';
                        link.href = '${capture.dataUrl}';
                        link.click();
                    }
                </script>
            </body>
            </html>
        `);
    }

    // 최근 캡처 삭제
    deleteRecentCapture(captureId) {
        if (confirm('이 캡처를 삭제하시겠습니까?')) {
            let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures = captures.filter(c => c.id !== captureId);
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            
            this.updateCaptureCount();
            this.showAlert('캡처가 삭제되었습니다.', 'info');
        }
    }

    // 캡처 다운로드
    downloadCapture(captureId) {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        const capture = captures.find(c => c.id === captureId);
        
        if (!capture) {
            this.showAlert('캡처를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.download = `stream-capture-${capture.streamKey}-${new Date(capture.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
        link.href = capture.dataUrl;
        link.click();
        
        this.showAlert('캡처가 다운로드되었습니다.', 'success');
    }

    // 모든 캡처 이미지 전체 삭제
    clearAllRecentCaptures() {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        
        if (captures.length === 0) {
            this.showAlert('삭제할 캡처 이미지가 없습니다.', 'info');
            return;
        }
        
        if (confirm(`모든 캡처 이미지 ${captures.length}개를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
            try {
                localStorage.removeItem('streamCaptures');
                this.updateCaptureCount();
                this.showAlert(`모든 캡처 이미지 ${captures.length}개가 삭제되었습니다.`, 'success');
                console.log('🗑️ 모든 캡처 이미지 삭제 완료:', captures.length, '개');
            } catch (error) {
                console.error('캡처 이미지 전체 삭제 실패:', error);
                this.showAlert('캡처 이미지 삭제에 실패했습니다.', 'error');
            }
        }
    }
    }

    // 자동 캡처 함수
    async autoCaptureAfterLoad() {
        try {
            console.log('🤖 자동 캡처 시작...');
            
            // 비디오가 로드되었는지 확인
            const video = document.querySelector('video');
            const videoContainer = document.querySelector('.video-container');
            
            if (!video || !videoContainer) {
                throw new Error('비디오 컨테이너를 찾을 수 없습니다.');
            }
            
            // 비디오 재생 상태 확인
            if (video.readyState < 2) {
                console.log('⏳ 비디오 로딩 대기 중...');
                setTimeout(() => this.autoCaptureAfterLoad(), 2000);
                return;
            }
            
            // 캡처 실행
            await this.captureVideoFrame();
            
            // 캡처 후 3초 뒤에 창 닫기
            setTimeout(() => {
                if (window.opener) {
                    window.close();
                }
            }, 3000);
            
        } catch (error) {
            console.error('자동 캡처 실패:', error);
            this.showAlert('자동 캡처에 실패했습니다: ' + error.message, 'error');
        }
    }

    // 화면 캡처 기능 (오버레이 포함)
    async captureVideoFrame() {
        try {
            // 비디오 컨테이너 찾기 (오버레이 포함된 전체 컨테이너)
            const videoContainer = document.querySelector('.video-container');
            if (!videoContainer) {
                throw new Error('비디오 컨테이너를 찾을 수 없습니다.');
            }

            console.log('📸 전체 화면 캡처 시작 (오버레이 포함)...');
            
            // 캡처 전 준비: 모든 오버레이가 표시되도록 확인
            const overlays = videoContainer.querySelectorAll('.video-overlay');
            overlays.forEach(overlay => {
                overlay.style.pointerEvents = 'none';
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            });
            
            // 잠시 대기하여 오버레이가 완전히 렌더링되도록 함
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // html2canvas를 사용하여 오버레이와 함께 전체 컨테이너 캡처
            const canvas = await html2canvas(videoContainer, {
                allowTaint: true,
                useCORS: true,
                backgroundColor: '#000000',
                width: videoContainer.offsetWidth,
                height: videoContainer.offsetHeight,
                scale: 1,
                logging: false,
                onclone: (clonedDoc) => {
                    // 클론된 문서에서도 오버레이가 제대로 표시되도록 설정
                    const clonedOverlays = clonedDoc.querySelectorAll('.video-overlay');
                    clonedOverlays.forEach(overlay => {
                        overlay.style.pointerEvents = 'none';
                        overlay.style.opacity = '1';
                        overlay.style.visibility = 'visible';
                        overlay.style.display = 'block';
                    });
                    
                    // 비디오 요소가 제대로 캡처되도록 설정
                    const clonedVideo = clonedDoc.querySelector('video');
                    if (clonedVideo) {
                        clonedVideo.style.objectFit = 'contain';
                        clonedVideo.style.width = '100%';
                        clonedVideo.style.height = '100%';
                    }
                }
            });

            // 캔버스를 이미지 데이터로 변환 (고화질 PNG)
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            // 현재 오버레이 정보 수집
            const overlayData = this.collectOverlayData();
            
            // 캡처 데이터 생성
            const captureData = {
                id: this.generateCaptureId(),
                dataUrl: dataUrl,
                timestamp: new Date().toISOString(),
                streamKey: this.currentStreamKey || 'unknown',
                width: canvas.width,
                height: canvas.height,
                overlayData: overlayData,
                captureType: 'full_overlay' // 오버레이 포함 캡처임을 표시
            };

            // localStorage에 저장
            this.saveCaptureToStorage(captureData);

            // 사용자에게 알림
            this.showAlert('오버레이 포함 전체 화면이 성공적으로 캡처되었습니다!', 'success');

            // 캡처 효과 (화면 플래시)
            this.showCaptureEffect();

            console.log('✅ 전체 화면 캡처 완료 (오버레이 포함):', captureData.id);
            console.log('📊 캡처 해상도:', `${canvas.width}x${canvas.height}`);
            console.log('🎯 포함된 오버레이:', overlayData);
            
            return captureData;

        } catch (error) {
            console.error('전체 화면 캡처 실패:', error);
            this.showAlert('화면 캡처에 실패했습니다: ' + error.message, 'error');
            throw error;
        }
    }

    // 오버레이 데이터 수집
    collectOverlayData() {
        const overlayData = {};
        
        try {
            // 서비스명 오버레이
            const serviceOverlay = document.querySelector('.overlay-service-name');
            if (serviceOverlay) {
                overlayData.serviceName = serviceOverlay.textContent;
            }
            
            // 시간 오버레이
            const timeOverlay = document.querySelector('.overlay-time');
            if (timeOverlay) {
                const timeElement = timeOverlay.querySelector('.overlay-current-time');
                const dateElement = timeOverlay.querySelector('.overlay-date');
                overlayData.time = timeElement ? timeElement.textContent : '';
                overlayData.date = dateElement ? dateElement.textContent : '';
            }
            
            // 데이터 오버레이
            const dataOverlay = document.querySelector('.overlay-data');
            if (dataOverlay) {
                const dataFields = ['LATITUDE', 'LONGITUDE', 'ALTITUDE', 'SPEED', 'AZIMUTH', 'TILT', 'ROLL'];
                overlayData.sensorData = {};
                
                dataFields.forEach(field => {
                    const element = dataOverlay.querySelector(`[data-field="${field}"]`);
                    if (element) {
                        overlayData.sensorData[field] = element.textContent;
                    }
                });
            }
            
        } catch (error) {
            console.warn('오버레이 데이터 수집 중 오류:', error);
        }
        
        return overlayData;
    }

    // 캡처 ID 생성
    generateCaptureId() {
        return 'capture_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 캡처 데이터를 localStorage에 저장
    saveCaptureToStorage(captureData) {
        try {
            let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures.unshift(captureData); // 최신 캡처를 맨 앞에 추가
            
            // 최대 50개까지만 저장 (용량 관리)
            if (captures.length > 50) {
                captures = captures.slice(0, 50);
            }
            
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            console.log('✅ 캡처 데이터 저장 완료:', captureData.id);
            
            // 실시간 캡처 목록 업데이트
            this.updateCaptureCount();
            
        } catch (error) {
            console.error('캡처 데이터 저장 실패:', error);
            throw new Error('저장 공간 부족 또는 저장 오류');
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
        streamViewer.stopAutoCapture(); // 자동 캡처 정리
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

// 화면 캡처 함수 (전역)
async function captureFrame() {
    if (!streamViewer) {
        alert('스트림 뷰어가 초기화되지 않았습니다.');
        return;
    }

    try {
        await streamViewer.captureVideoFrame();
    } catch (error) {
        console.error('캡처 실행 실패:', error);
    }
}

// 캡처 갤러리 열기
function openCaptureGallery() {
    if (!streamViewer || !streamViewer.currentStreamKey) {
        alert('스트림 키가 설정되지 않았습니다.');
        return;
    }
    
    const galleryUrl = `camera.html?key=${streamViewer.currentStreamKey}`;
    window.open(galleryUrl, '_blank');
}

// 자동 캡처 토글
function toggleAutoCapture() {
    if (!streamViewer) {
        alert('스트림 뷰어가 초기화되지 않았습니다.');
        return;
    }
    
    const btn = document.getElementById('autoCaptureBtn');
    
    if (streamViewer.autoCapture) {
        // 자동 캡처 중지
        streamViewer.stopAutoCapture();
        btn.innerHTML = '<i class="fas fa-clock me-2"></i>자동 캡처 시작';
        btn.className = 'btn btn-outline-success w-100 mb-2';
        streamViewer.showAlert('자동 캡처가 중지되었습니다.', 'info');
    } else {
        // 자동 캡처 시작
        const interval = prompt('자동 캡처 간격을 입력하세요 (초 단위):', '30');
        if (interval && !isNaN(interval) && parseInt(interval) > 0) {
            streamViewer.startAutoCapture(parseInt(interval));
            btn.innerHTML = '<i class="fas fa-stop me-2"></i>자동 캡처 중지';
            btn.className = 'btn btn-warning w-100 mb-2';
            streamViewer.showAlert(`${interval}초마다 자동 캡처가 시작되었습니다.`, 'success');
        }
    }
    
    // 상태 업데이트
    streamViewer.updateAutoCaptureStatus();
}

// StreamViewer 클래스에 자동 캡처 메서드 추가
StreamViewer.prototype.startAutoCapture = function(intervalSeconds) {
    this.stopAutoCapture(); // 기존 자동 캡처 중지
    
    this.autoCapture = true;
    this.autoCaptureInterval = setInterval(async () => {
        try {
            await this.captureVideoFrame();
            console.log('✅ 자동 캡처 완료');
        } catch (error) {
            console.error('❌ 자동 캡처 실패:', error);
        }
    }, intervalSeconds * 1000);
    
    this.updateAutoCaptureStatus();
    console.log(`🤖 자동 캡처 시작: ${intervalSeconds}초 간격`);
};

StreamViewer.prototype.stopAutoCapture = function() {
    if (this.autoCaptureInterval) {
        clearInterval(this.autoCaptureInterval);
        this.autoCaptureInterval = null;
    }
    this.autoCapture = false;
    this.updateAutoCaptureStatus();
    console.log('🛑 자동 캡처 중지');
};

// 모든 캡처 이미지 전체 삭제 (전역 함수)
function clearAllRecentCaptures() {
    if (!streamViewer) {
        alert('스트림 뷰어가 초기화되지 않았습니다.');
        return;
    }
    
    streamViewer.clearAllRecentCaptures();
}
