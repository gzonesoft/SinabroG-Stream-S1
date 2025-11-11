/**
 * 캡처 API 설정 파일
 * API를 사용하려면 이 파일에서 설정을 변경하세요.
 */

// API 설정
const CAPTURE_API_CONFIG = {
    // API 활성화 여부 (true: API 사용, false: localStorage 사용)
    enableAPI: false,
    
    // API 서버 URL
    apiUrl: "http://localhost:17321",
    
    // API 키 (실제 키로 교체 필요)
    apiKey: "your-anon-key-here",
    
    // 자동 마이그레이션 여부
    autoMigrate: false,
    
    // 조용한 모드 (콘솔 로그 최소화)
    silent: true,
    
    // API 연결 시도 횟수
    maxRetries: 3,
    
    // API 연결 타임아웃 (ms)
    timeout: 5000
};

// 페이지별 설정 (필요시 페이지별로 다르게 설정 가능)
const PAGE_CONFIG = {
    'watch.html': {
        enableAPI: false,  // watch 페이지에서는 API 비활성화
        silent: true
    },
    'camera.html': {
        enableAPI: false,  // 필요시 true로 변경
        autoMigrate: false,
        silent: false
    }
};

// 현재 페이지 설정 가져오기
function getPageConfig() {
    const currentPage = window.location.pathname.split('/').pop();
    return { ...CAPTURE_API_CONFIG, ...(PAGE_CONFIG[currentPage] || {}) };
}

// API 초기화 (페이지 로드 시 자동 실행)
window.addEventListener('DOMContentLoaded', async () => {
    const config = getPageConfig();
    
    // API가 활성화되어 있을 때만 초기화
    if (config.enableAPI) {
        // API 설정 적용
        if (window.captureStorage) {
            window.captureStorage.baseURL = config.apiUrl;
            window.captureStorage.headers.apikey = config.apiKey;
            window.captureStorage.headers.Authorization = `Bearer ${config.apiKey}`;
        }
        
        // API 초기화
        if (window.initializeCaptureAPI) {
            await window.initializeCaptureAPI({
                autoMigrate: config.autoMigrate,
                silent: config.silent
            });
        }
    } else {
        // localStorage 모드 유지
        if (!config.silent) {
            console.log('📦 localStorage 모드로 실행 중');
        }
    }
});

// 수동 API 활성화 함수
window.enableCaptureAPI = async function(apiKey) {
    if (!apiKey) {
        console.error('API 키가 필요합니다.');
        return false;
    }
    
    // API 키 설정
    CAPTURE_API_CONFIG.apiKey = apiKey;
    CAPTURE_API_CONFIG.enableAPI = true;
    
    // captureStorage 설정 업데이트
    if (window.captureStorage) {
        window.captureStorage.headers.apikey = apiKey;
        window.captureStorage.headers.Authorization = `Bearer ${apiKey}`;
    }
    
    // API 초기화
    if (window.initializeCaptureAPI) {
        const success = await window.initializeCaptureAPI({
            autoMigrate: true,
            silent: false
        });
        
        if (success) {
            console.log('✅ API가 성공적으로 활성화되었습니다.');
            return true;
        } else {
            console.error('❌ API 활성화에 실패했습니다.');
            return false;
        }
    }
    
    return false;
};

console.log('⚙️ 캡처 API 설정 로드 완료');
console.log('📝 API 활성화: window.enableCaptureAPI("your-api-key")');