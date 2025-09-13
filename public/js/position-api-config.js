/**
 * 위치정보 API 설정 파일
 * 페이지별로 위치정보 API 활성화 여부를 제어
 */

// 현재 페이지 URL 확인
const currentPage = window.location.pathname;

// 페이지별 설정
const POSITION_API_PAGES = {
    '/watch.html': true,      // 시청 화면에서 활성화
    '/camera.html': true,     // 갤러리 화면에서 활성화
    '/viewer.html': true,     // 뷰어에서 활성화
    '/index.html': false,     // 메인 페이지에서는 비활성화
    '/test-storage-quota.html': false  // 테스트 페이지에서는 비활성화
};

// 기본 설정
const POSITION_API_DEFAULT_CONFIG = {
    enabled: false,           // 기본적으로 비활성화
    autoStart: true,         // 활성화 시 자동 시작
    migrateOnLoad: false,    // 페이지 로드 시 자동 마이그레이션
    sendInterval: 5000,      // 5초마다 전송
    batchSize: 50,          // 배치 크기
    debug: true             // 디버그 모드
};

// 현재 페이지 설정 확인
function shouldEnablePositionAPI() {
    // URL에서 쿼리 파라미터 확인
    const params = new URLSearchParams(window.location.search);
    if (params.has('position_api')) {
        return params.get('position_api') === 'true';
    }
    
    // 페이지별 설정 확인
    for (const [page, enabled] of Object.entries(POSITION_API_PAGES)) {
        if (currentPage.includes(page)) {
            return enabled;
        }
    }
    
    return POSITION_API_DEFAULT_CONFIG.enabled;
}

// 위치정보 API 초기화
function initializePositionAPI() {
    if (!shouldEnablePositionAPI()) {
        console.log('⏸️ Position API 비활성화됨 (페이지:', currentPage, ')');
        return null;
    }

    console.log('✅ Position API 활성화됨 (페이지:', currentPage, ')');
    
    // position-api-client.js가 로드되었는지 확인
    if (typeof PositionAPIClient === 'undefined') {
        console.error('❌ PositionAPIClient가 정의되지 않음. position-api-client.js를 먼저 로드하세요.');
        return null;
    }

    // 전역 인스턴스가 이미 있으면 재사용
    if (window.positionAPI) {
        console.log('♻️ 기존 Position API 인스턴스 재사용');
        return window.positionAPI;
    }

    // 새 인스턴스 생성
    const config = {
        ...POSITION_API_CONFIG,
        ...POSITION_API_DEFAULT_CONFIG
    };
    
    window.positionAPI = new PositionAPIClient(config);
    
    // 실시간 위치 데이터 수신 설정
    setupRealtimePositionListener();
    
    // 자동 마이그레이션
    if (POSITION_API_DEFAULT_CONFIG.migrateOnLoad) {
        console.log('🔄 자동 마이그레이션 시작...');
        window.positionAPI.migrateFromLocalStorage().then(result => {
            if (result.success) {
                console.log(`✅ ${result.count}개 위치 데이터 마이그레이션 완료`);
            } else {
                console.error('❌ 마이그레이션 실패:', result.error);
            }
        });
    }
    
    return window.positionAPI;
}

// 실시간 위치 데이터 수신 설정
function setupRealtimePositionListener() {
    // 폴링 방식으로 위치 데이터 확인
    let lastTimestamp = null;
    
    setInterval(async () => {
        try {
            const response = await fetch('/api/overlay-data');
            const data = await response.json();
            
            // 새로운 데이터인지 확인
            if (data._lastUpdated && data._lastUpdated !== lastTimestamp) {
                lastTimestamp = data._lastUpdated;
                
                // Position API로 전송
                if (window.positionAPI) {
                    await window.positionAPI.sendPosition(data);
                    console.log('📍 실시간 위치 데이터 전송:', data.LATITUDE, data.LONGITUDE, data.ALTITUDE);
                }
            }
        } catch (error) {
            console.error('실시간 위치 데이터 수신 실패:', error);
        }
    }, 3000); // 3초마다 확인
    
    console.log('🔄 실시간 위치 데이터 리스너 시작 (3초 간격)');
}

// 페이지 로드 시 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePositionAPI);
} else {
    initializePositionAPI();
}

// 디버그 정보 출력
if (POSITION_API_DEFAULT_CONFIG.debug) {
    console.log('📍 Position API 설정:', {
        currentPage,
        enabled: shouldEnablePositionAPI(),
        config: POSITION_API_DEFAULT_CONFIG
    });
}