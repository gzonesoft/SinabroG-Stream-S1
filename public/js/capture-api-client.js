/**
 * AH 드론 캡처 API 클라이언트
 * localStorage를 대체하는 API 기반 캡처 관리 시스템
 */

// API 설정
const SUPABASE_URL = "http://localhost:17321";
const SUPABASE_ANON_KEY = "your-anon-key-here"; // 실제 키로 교체 필요

// API 헤더 설정
const API_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

// localStorage 관리 설정
const STORAGE_CONFIG = {
    MAX_SIZE: 4.9 * 1024 * 1024, // 4.9MB (5MB 제한의 98%)
    MAX_CAPTURES: 999999, // 개수 제한 사실상 없음
    MIN_FREE_SPACE: 100 * 1024 // 최소 여유 공간 100KB
};

/**
 * localStorage 용량 관리 유틸리티
 */
class StorageQuotaManager {
    /**
     * localStorage 사용량 계산 (캡처 관련 키만)
     */
    static calculateStorageSize() {
        let totalSize = 0;
        // 캡처 관련 키만 계산
        const captureKeys = ['streamCaptures', 'captureData', 'dronePositionHistory'];
        
        for (let key of captureKeys) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                if (value) {
                    totalSize += value.length + key.length;
                }
            }
        }
        return totalSize * 2; // UTF-16 인코딩 고려 (각 문자 2바이트)
    }

    /**
     * 캡처 데이터 크기 계산
     */
    static calculateCaptureSize(capture) {
        const captureString = JSON.stringify(capture);
        return captureString.length * 2; // UTF-16
    }

    /**
     * 가장 오래된 캡처 삭제 (용량 부족시에만)
     */
    static deleteOldestCaptures(count = 1) {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        if (captures.length === 0) return 0;

        // 타임스탬프로 정렬 (오래된 것부터)
        captures.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
        });

        // 지정된 개수만큼 삭제
        const deleteCount = Math.min(count, captures.length);
        const remaining = captures.slice(deleteCount);
        
        localStorage.setItem('streamCaptures', JSON.stringify(remaining));
        console.log(`용량 부족으로 오래된 캡처 ${deleteCount}개 삭제 (${remaining.length}개 유지)`);
        return deleteCount;
    }

    /**
     * 저장 공간 확보 (용량 기반만)
     */
    static ensureStorageSpace(requiredSize) {
        const currentSize = this.calculateStorageSize();
        const availableSpace = STORAGE_CONFIG.MAX_SIZE - currentSize;

        console.log(`📊 현재: ${(currentSize / 1024 / 1024).toFixed(2)}MB, 필요: ${(requiredSize / 1024 / 1024).toFixed(2)}MB, 여유: ${(availableSpace / 1024 / 1024).toFixed(2)}MB`);

        // 여유 공간이 충분하면 OK
        if (availableSpace >= requiredSize + STORAGE_CONFIG.MIN_FREE_SPACE) {
            return true;
        }

        // 공간 부족시 오래된 캡처 삭제
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        if (captures.length === 0) {
            // 캡처가 없지만 공간이 부족한 경우, 다른 데이터 정리
            console.warn('캡처 데이터가 없지만 공간 부족 - 다른 캐시 데이터 정리');
            
            // dronePositionHistory 정리
            const positionHistory = localStorage.getItem('dronePositionHistory');
            if (positionHistory && positionHistory.length > 10000) {
                try {
                    const positions = JSON.parse(positionHistory);
                    // 최근 50개만 유지
                    const recentPositions = positions.slice(-50);
                    localStorage.setItem('dronePositionHistory', JSON.stringify(recentPositions));
                    console.log('위치 기록 정리 완료');
                } catch (e) {
                    localStorage.removeItem('dronePositionHistory');
                    console.log('위치 기록 삭제 완료');
                }
            }
            
            // 재계산
            const newSize = this.calculateStorageSize();
            const newAvailable = STORAGE_CONFIG.MAX_SIZE - newSize;
            return newAvailable >= requiredSize + STORAGE_CONFIG.MIN_FREE_SPACE;
        }

        // 필요한 공간을 확보할 때까지 삭제
        let deletedCount = 0;
        let maxIterations = 10; // 무한 루프 방지
        
        while (maxIterations-- > 0) {
            const currentStorageSize = this.calculateStorageSize();
            if (currentStorageSize + requiredSize <= STORAGE_CONFIG.MAX_SIZE - STORAGE_CONFIG.MIN_FREE_SPACE) {
                break; // 충분한 공간 확보됨
            }
            
            const deleted = this.deleteOldestCaptures(5); // 5개씩 삭제
            if (deleted === 0) {
                console.error('더 이상 삭제할 캡처가 없음');
                break;
            }
            deletedCount += deleted;
        }

        if (deletedCount > 0) {
            console.log(`공간 확보를 위해 ${deletedCount}개 캡처 삭제`);
        }
        
        // 최종 확인
        const finalSize = this.calculateStorageSize();
        const finalAvailable = STORAGE_CONFIG.MAX_SIZE - finalSize;
        return finalAvailable >= requiredSize;
    }

    /**
     * 캡처 개수 제한 확인 (사실상 비활성화)
     */
    static checkCaptureLimit() {
        // 개수 제한 없음 - 용량만 체크
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        console.log(`📸 현재 캡처 개수: ${captures.length}개`);
        // 개수 제한 없이 용량만 관리
        return;
    }

    /**
     * 저장 가능 여부 확인
     */
    static canSaveCapture(capture) {
        const captureSize = this.calculateCaptureSize(capture);
        return this.ensureStorageSpace(captureSize);
    }
}

/**
 * localStorage와 호환되는 캡처 저장소 어댑터
 */
class CaptureStorageAdapter {
    constructor(useAPI = true) {
        this.useAPI = useAPI;
        this.baseURL = SUPABASE_URL;
        this.headers = API_HEADERS;
        this.deviceId = this.getDeviceId();
    }

    /**
     * 디바이스 ID 생성 또는 가져오기
     */
    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'WEB_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    /**
     * 캡처 목록 조회 (localStorage 호환)
     */
    async getCaptures(streamKey = null) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_get_captures`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_device_id: null, // 모든 디바이스의 캡처 조회
                        p_stream_key: streamKey,
                        p_limit: 1000,
                        p_offset: 0
                    })
                });

                if (!response.ok) {
                    throw new Error(`API 오류: ${response.status}`);
                }

                const data = await response.json();

                // localStorage 형식으로 변환
                const captures = data.map(item => ({
                    id: item.capture_id,
                    timestamp: new Date(item.timestamp).getTime(),
                    imageData: item.image_url, // API는 URL 반환
                    streamKey: item.stream_key,
                    title: item.title || '',
                    droneData: {
                        lat: item.drone_lat,
                        lng: item.drone_lng,
                        alt: item.drone_alt,
                        heading: item.drone_heading
                    },
                    description: item.description,
                    tags: item.tags || []
                }));
                
                // 최신순 정렬 (timestamp 기준 내림차순)
                captures.sort((a, b) => b.timestamp - a.timestamp);
                
                return captures;
            } catch (error) {
                console.error('API 조회 실패, localStorage 사용:', error);
                this.useAPI = false;
            }
        }

        // localStorage 폴백
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        if (streamKey) {
            captures = captures.filter(c => c.streamKey === streamKey);
        }
        
        // 최신순 정렬 (timestamp 기준 내림차순)
        captures.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA; // 최신이 먼저 (내림차순)
        });
        
        return captures;
    }

    /**
     * 캡처 저장 (localStorage 호환)
     */
    async saveCapture(capture) {
        // localStorage 사용 시 용량 체크
        if (!this.useAPI) {
            // 저장 전 용량 확인
            if (!StorageQuotaManager.canSaveCapture(capture)) {
                console.error('저장 공간 부족 - 캡처 저장 실패');
                return { success: false, error: 'Storage quota exceeded' };
            }
            
            // 캡처 개수 로그만 (제한 없음)
            StorageQuotaManager.checkCaptureLimit();
        }

        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_create_capture`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_capture_id: capture.id || Date.now().toString(),
                        p_device_id: this.deviceId,
                        p_timestamp: new Date(capture.timestamp || Date.now()).toISOString(),
                        p_stream_key: capture.streamKey || 'unknown',
                        p_title: capture.title || '제목 없음',
                        p_image_data: capture.imageData,
                        p_drone_data: capture.droneData || null,
                        p_metadata: {
                            fileSize: this.getBase64Size(capture.imageData),
                            mimeType: this.getMimeType(capture.imageData),
                            width: capture.width || 1920,
                            height: capture.height || 1080
                        },
                        p_tags: capture.tags || [],
                        p_description: capture.description || ''
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API 저장 실패: ${response.status} - ${errorText}`);
                }

                const result = await response.json();
                console.log('캡처 저장 성공:', result);
                return result;
            } catch (error) {
                console.error('API 저장 실패, localStorage 사용:', error);
                this.useAPI = false;
            }
        }

        // localStorage 폴백
        try {
            const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            captures.push(capture);
            localStorage.setItem('streamCaptures', JSON.stringify(captures));
            
            // 저장 후 용량 상태 로그
            const currentSize = StorageQuotaManager.calculateStorageSize();
            const usagePercent = ((currentSize / STORAGE_CONFIG.MAX_SIZE) * 100).toFixed(1);
            console.log(`localStorage 사용량: ${usagePercent}% (${(currentSize/1024).toFixed(1)}KB / ${(STORAGE_CONFIG.MAX_SIZE/1024).toFixed(1)}KB)`);
            
            return { success: true, capture_id: capture.id };
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage 용량 초과');
                // 오래된 캡처 삭제 후 재시도
                if (StorageQuotaManager.deleteOldestCaptures(5) > 0) {
                    try {
                        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
                        captures.push(capture);
                        localStorage.setItem('streamCaptures', JSON.stringify(captures));
                        return { success: true, capture_id: capture.id, warning: 'Old captures deleted' };
                    } catch (retryError) {
                        console.error('재시도 실패:', retryError);
                        return { success: false, error: 'Storage quota exceeded after cleanup' };
                    }
                }
            }
            console.error('localStorage 저장 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 캡처 삭제 (localStorage 호환)
     */
    async deleteCapture(captureId) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_delete_capture`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_capture_id: captureId
                    })
                });

                if (!response.ok) {
                    throw new Error(`API 삭제 실패: ${response.status}`);
                }

                const result = await response.json();
                console.log('캡처 삭제 성공:', result);
                return result;
            } catch (error) {
                console.error('API 삭제 실패, localStorage 사용:', error);
                this.useAPI = false;
            }
        }

        // localStorage 폴백
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        captures = captures.filter(c => c.id !== captureId);
        localStorage.setItem('streamCaptures', JSON.stringify(captures));
        return { success: true };
    }

    /**
     * 모든 캡처 삭제
     */
    async clearAllCaptures(streamKey = null) {
        if (this.useAPI) {
            try {
                // API에 ah_delete_all_captures 함수가 없으므로 개별 삭제 수행
                const captures = await this.getCaptures(streamKey);
                const deletePromises = captures.map(c => this.deleteCapture(c.id));
                await Promise.all(deletePromises);
                console.log(`${captures.length}개 캡처 삭제 완료`);
                return { success: true, deleted: captures.length };
            } catch (error) {
                console.error('전체 삭제 실패:', error);
                this.useAPI = false;
            }
        }

        // localStorage 폴백
        if (streamKey) {
            let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            const filtered = captures.filter(c => c.streamKey !== streamKey);
            localStorage.setItem('streamCaptures', JSON.stringify(filtered));
        } else {
            localStorage.removeItem('streamCaptures');
        }
        return { success: true };
    }

    /**
     * 배치 캡처 저장
     */
    async batchSaveCaptures(capturesList) {
        // localStorage 사용 시 전체 크기 확인
        if (!this.useAPI) {
            const totalSize = capturesList.reduce((sum, capture) => 
                sum + StorageQuotaManager.calculateCaptureSize(capture), 0);
            
            if (!StorageQuotaManager.ensureStorageSpace(totalSize)) {
                console.error('배치 저장 공간 부족');
                // 부분 저장 시도
                const savedCaptures = [];
                for (const capture of capturesList) {
                    const result = await this.saveCapture(capture);
                    if (result.success) {
                        savedCaptures.push(capture);
                    } else {
                        console.warn(`캡처 저장 실패: ${capture.id}`);
                        break;
                    }
                }
                return { success: savedCaptures.length > 0, count: savedCaptures.length, partial: true };
            }
        }

        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_batch_create_captures`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_captures: capturesList.map(capture => ({
                            id: capture.id || Date.now().toString(),
                            deviceId: this.deviceId,
                            timestamp: new Date(capture.timestamp || Date.now()).toISOString(),
                            streamKey: capture.streamKey || 'unknown',
                            title: capture.title || '제목 없음',
                            imageData: capture.imageData,
                            droneData: capture.droneData || null,
                            tags: capture.tags || [],
                            description: capture.description || ''
                        }))
                    })
                });

                if (!response.ok) {
                    throw new Error(`배치 저장 실패: ${response.status}`);
                }

                const result = await response.json();
                console.log('배치 저장 성공:', result);
                return result;
            } catch (error) {
                console.error('배치 저장 실패:', error);
                // 개별 저장으로 폴백
                const results = [];
                for (const capture of capturesList) {
                    results.push(await this.saveCapture(capture));
                }
                return { success: true, results };
            }
        }

        // localStorage 폴백
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        captures.push(...capturesList);
        localStorage.setItem('streamCaptures', JSON.stringify(captures));
        return { success: true, count: capturesList.length };
    }

    /**
     * 캡처 검색
     */
    async searchCaptures(searchParams) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_search_captures`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_search_term: searchParams.query || null,
                        p_tags: searchParams.tags || null,
                        p_start_date: searchParams.startDate || null,
                        p_end_date: searchParams.endDate || null,
                        p_is_public: searchParams.isPublic || null,
                        p_limit: searchParams.limit || 50,
                        p_offset: searchParams.offset || 0
                    })
                });

                if (!response.ok) {
                    throw new Error(`검색 실패: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('검색 실패:', error);
                // localStorage에서 검색
                return this.searchInLocalStorage(searchParams);
            }
        }

        return this.searchInLocalStorage(searchParams);
    }

    /**
     * localStorage에서 검색 (폴백)
     */
    searchInLocalStorage(searchParams) {
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');

        if (searchParams.query) {
            const query = searchParams.query.toLowerCase();
            captures = captures.filter(c => 
                (c.title && c.title.toLowerCase().includes(query)) ||
                (c.description && c.description.toLowerCase().includes(query))
            );
        }

        if (searchParams.tags && searchParams.tags.length > 0) {
            captures = captures.filter(c => 
                c.tags && searchParams.tags.some(tag => c.tags.includes(tag))
            );
        }

        if (searchParams.streamKey) {
            captures = captures.filter(c => c.streamKey === searchParams.streamKey);
        }

        return captures;
    }

    /**
     * 캡처 통계 조회
     */
    async getCaptureStats(streamKey = null) {
        if (this.useAPI) {
            try {
                const response = await fetch(`${this.baseURL}/rest/v1/rpc/ah_get_capture_stats`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        p_device_id: this.deviceId,
                        p_stream_key: streamKey,
                        p_period_days: 30
                    })
                });

                if (!response.ok) {
                    throw new Error(`통계 조회 실패: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('통계 조회 실패:', error);
                return this.getLocalStats(streamKey);
            }
        }

        return this.getLocalStats(streamKey);
    }

    /**
     * localStorage 통계 (폴백)
     */
    getLocalStats(streamKey = null) {
        let captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        
        if (streamKey) {
            captures = captures.filter(c => c.streamKey === streamKey);
        }

        const totalSize = captures.reduce((sum, c) => 
            sum + (c.imageData ? this.getBase64Size(c.imageData) : 0), 0
        );

        const tags = {};
        captures.forEach(c => {
            if (c.tags) {
                c.tags.forEach(tag => {
                    tags[tag] = (tags[tag] || 0) + 1;
                });
            }
        });

        return {
            total_captures: captures.length,
            total_size_bytes: totalSize,
            total_size_mb: (totalSize / (1024 * 1024)).toFixed(2),
            popular_tags: Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 10),
            recent_captures: captures.filter(c => {
                const captureDate = new Date(c.timestamp);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return captureDate > thirtyDaysAgo;
            }).length
        };
    }

    /**
     * localStorage에서 API로 마이그레이션
     */
    async migrateFromLocalStorage() {
        const localCaptures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        
        if (localCaptures.length === 0) {
            console.log('마이그레이션할 캡처가 없습니다.');
            return { success: true, migrated: 0 };
        }

        console.log(`${localCaptures.length}개 캡처 마이그레이션 시작...`);

        try {
            const result = await this.batchSaveCaptures(localCaptures);
            
            if (result.success) {
                // 성공 시 localStorage 클리어
                localStorage.removeItem('streamCaptures');
                console.log('마이그레이션 완료! localStorage 데이터 삭제됨');
                return { success: true, migrated: localCaptures.length };
            }
        } catch (error) {
            console.error('마이그레이션 실패:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Base64 이미지 크기 계산
     */
    getBase64Size(base64String) {
        if (!base64String) return 0;
        const base64 = base64String.split(',')[1] || base64String;
        return Math.round(base64.length * 0.75);
    }

    /**
     * MIME 타입 추출
     */
    getMimeType(base64String) {
        if (!base64String) return 'image/jpeg';
        const match = base64String.match(/^data:([^;]+);/);
        return match ? match[1] : 'image/jpeg';
    }

    /**
     * API 상태 확인
     */
    async checkAPIStatus() {
        try {
            const response = await fetch(`${this.baseURL}/rest/v1/`, {
                headers: this.headers
            });
            this.useAPI = response.ok;
            return response.ok;
        } catch (error) {
            console.error('API 연결 실패:', error);
            this.useAPI = false;
            return false;
        }
    }

    /**
     * 이미지 압축
     */
    async compressImage(base64String, maxWidth = 1920, quality = 0.8) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64String;
        });
    }

    /**
     * localStorage 상태 정보 조회
     */
    getStorageStatus() {
        const currentSize = StorageQuotaManager.calculateStorageSize();
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        const usagePercent = ((currentSize / STORAGE_CONFIG.MAX_SIZE) * 100).toFixed(1);
        
        return {
            currentSize: currentSize,
            maxSize: STORAGE_CONFIG.MAX_SIZE,
            usagePercent: parseFloat(usagePercent),
            captureCount: captures.length,
            maxCaptures: STORAGE_CONFIG.MAX_CAPTURES,
            availableSpace: STORAGE_CONFIG.MAX_SIZE - currentSize,
            isNearLimit: currentSize > STORAGE_CONFIG.MAX_SIZE * 0.8,
            formattedSize: `${(currentSize/1024).toFixed(1)}KB / ${(STORAGE_CONFIG.MAX_SIZE/1024).toFixed(1)}KB`
        };
    }

    /**
     * 수동으로 오래된 캡처 정리
     */
    async cleanupOldCaptures(keepCount = 50) {
        const captures = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
        if (captures.length <= keepCount) {
            console.log('정리할 캡처가 없음');
            return { success: true, deleted: 0 };
        }

        const deleteCount = captures.length - keepCount;
        const deleted = StorageQuotaManager.deleteOldestCaptures(deleteCount);
        
        return {
            success: true,
            deleted: deleted,
            remaining: captures.length - deleted,
            storageStatus: this.getStorageStatus()
        };
    }
}

// 전역 인스턴스 생성 (기본적으로 localStorage 모드로 시작)
window.captureStorage = new CaptureStorageAdapter(false);

// 초기화 함수 (자동 실행하지 않음)
window.initializeCaptureAPI = async function(options = {}) {
    const { autoMigrate = false, silent = false } = options;
    
    if (!silent) {
        console.log('캡처 API 초기화 중...');
    }
    
    // API 상태 확인
    const apiAvailable = await window.captureStorage.checkAPIStatus();
    
    if (apiAvailable) {
        window.captureStorage.useAPI = true;
        if (!silent) {
            console.log('✅ API 연결 성공');
        }
        
        // autoMigrate가 true일 때만 마이그레이션 제안
        if (autoMigrate) {
            const localData = JSON.parse(localStorage.getItem('streamCaptures') || '[]');
            if (localData.length > 0) {
                console.log(`📦 ${localData.length}개의 로컬 캡처 발견`);
                if (confirm(`${localData.length}개의 로컬 캡처를 클라우드로 마이그레이션하시겠습니까?`)) {
                    const result = await window.captureStorage.migrateFromLocalStorage();
                    if (result.success && !silent) {
                        alert(`${result.migrated}개 캡처가 성공적으로 마이그레이션되었습니다.`);
                    }
                }
            }
        }
    } else {
        window.captureStorage.useAPI = false;
        if (!silent) {
            console.warn('⚠️ API 연결 실패, localStorage 모드로 작동');
        }
    }
    
    return apiAvailable;
};

// 디버그 헬퍼
window.captureDebug = {
    // API 상태 확인
    checkStatus: () => window.captureStorage.checkAPIStatus(),
    
    // 통계 보기
    showStats: async () => {
        const stats = await window.captureStorage.getCaptureStats();
        console.table(stats);
        return stats;
    },
    
    // 캡처 목록 보기
    listCaptures: async (streamKey) => {
        const captures = await window.captureStorage.getCaptures(streamKey);
        console.table(captures);
        return captures;
    },
    
    // 마이그레이션 실행
    migrate: () => window.captureStorage.migrateFromLocalStorage(),
    
    // API/localStorage 모드 전환
    toggleMode: () => {
        window.captureStorage.useAPI = !window.captureStorage.useAPI;
        console.log(`모드 전환: ${window.captureStorage.useAPI ? 'API' : 'localStorage'}`);
    }
};

console.log('💾 캡처 API 클라이언트 로드 완료 (localStorage 모드)');
console.log('🔧 API 초기화: window.initializeCaptureAPI() 실행');
console.log('🔧 디버그: window.captureDebug 사용 가능');