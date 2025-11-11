#!/usr/bin/env node

/**
 * 위치정보 이력 마이그레이션 도구
 * 로그 파일에서 위치 데이터를 읽어서 API로 전송
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// API 설정
const API_CONFIG = {
    SUPABASE_URL: "http://localhost:17321",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NzM2NzgwLCJleHAiOjE3ODkyNzI3ODB9.ysKG7uo3HrMGeO8evJAs-ce01Jp-xxZ0CWa6ZQTcdVY", // 2025년 유효한 JWT 토큰
    BATCH_SIZE: 100,
    RETRY_COUNT: 3
};

const API_HEADERS = {
    'apikey': API_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

/**
 * 위치정보 마이그레이션 클래스
 */
class PositionMigrator {
    constructor() {
        this.stats = {
            totalProcessed: 0,
            totalSent: 0,
            totalFailed: 0,
            filesProcessed: 0
        };
    }

    /**
     * 로그 파일에서 위치 데이터 파싱
     */
    async parseLogFile(filePath) {
        console.log(`📁 로그 파일 파싱: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`파일이 존재하지 않습니다: ${filePath}`);
        }

        const positions = [];
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineNumber = 0;
        for await (const line of rl) {
            lineNumber++;
            
            if (!line.trim()) continue;

            try {
                const position = JSON.parse(line.trim());
                
                // 유효성 검사
                if (this.isValidPosition(position)) {
                    positions.push(position);
                } else {
                    console.warn(`⚠️ 유효하지 않은 위치 데이터 (라인 ${lineNumber}):`, line.substring(0, 100));
                }
            } catch (error) {
                console.warn(`⚠️ JSON 파싱 실패 (라인 ${lineNumber}):`, error.message);
            }
        }

        console.log(`✅ ${positions.length}개 위치 데이터 파싱 완료`);
        return positions;
    }

    /**
     * 위치 데이터 유효성 검사
     */
    isValidPosition(position) {
        return position && 
               typeof position.LATITUDE === 'number' && 
               typeof position.LONGITUDE === 'number' &&
               position.DEVICE_ID &&
               (position.TIME || position.timestamp);
    }

    /**
     * 배치 전송
     */
    async sendBatch(positions) {
        if (!positions || positions.length === 0) {
            return { success: true, count: 0 };
        }

        console.log(`📤 배치 전송: ${positions.length}개`);

        for (let attempt = 1; attempt <= API_CONFIG.RETRY_COUNT; attempt++) {
            try {
                // Node.js 18+ 내장 fetch 사용
                
                // 단일 위치 데이터 전송 (배치가 아닌 개별 호출)
                let successCount = 0;
                let lastError = null;

                for (const pos of positions) {
                    try {
                        const response = await fetch(`${API_CONFIG.SUPABASE_URL}/rest/v1/rpc/ah_save_position_history`, {
                            method: 'POST',
                            headers: API_HEADERS,
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
                    this.stats.totalSent += successCount;
                    console.log(`✅ 배치 전송 성공: ${successCount}/${positions.length}개`);
                    return { success: true, count: successCount };
                } else {
                    throw new Error(lastError || '전송 실패');
                }

            } catch (error) {
                console.error(`❌ 배치 전송 실패 (시도 ${attempt}/${API_CONFIG.RETRY_COUNT}):`, error.message);
                
                if (attempt < API_CONFIG.RETRY_COUNT) {
                    await this.delay(1000 * attempt); // 지수 백오프
                } else {
                    this.stats.totalFailed += positions.length;
                    return { success: false, error: error.message };
                }
            }
        }
    }

    /**
     * 단일 파일 마이그레이션
     */
    async migrateFile(filePath) {
        try {
            const positions = await this.parseLogFile(filePath);
            this.stats.totalProcessed += positions.length;
            this.stats.filesProcessed++;

            if (positions.length === 0) {
                console.log('마이그레이션할 데이터가 없습니다.');
                return { success: true, count: 0 };
            }

            // 배치로 나누어 전송
            let totalSent = 0;
            for (let i = 0; i < positions.length; i += API_CONFIG.BATCH_SIZE) {
                const batch = positions.slice(i, i + API_CONFIG.BATCH_SIZE);
                const result = await this.sendBatch(batch);
                
                if (result.success) {
                    totalSent += result.count;
                    console.log(`진행률: ${totalSent}/${positions.length}`);
                } else {
                    console.error('배치 전송 실패, 마이그레이션 중단');
                    break;
                }
            }

            return { success: true, count: totalSent };

        } catch (error) {
            console.error('파일 마이그레이션 실패:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 디렉토리 마이그레이션
     */
    async migrateDirectory(dirPath) {
        console.log(`📂 디렉토리 마이그레이션: ${dirPath}`);
        
        if (!fs.existsSync(dirPath)) {
            throw new Error(`디렉토리가 존재하지 않습니다: ${dirPath}`);
        }

        const files = fs.readdirSync(dirPath)
            .filter(file => file.endsWith('.log'))
            .map(file => path.join(dirPath, file));

        console.log(`${files.length}개 로그 파일 발견`);

        for (const file of files) {
            console.log(`\n처리 중: ${path.basename(file)}`);
            await this.migrateFile(file);
        }
    }

    /**
     * 통계 출력
     */
    printStats() {
        console.log('\n========== 마이그레이션 완료 ==========');
        console.log(`📁 처리된 파일: ${this.stats.filesProcessed}개`);
        console.log(`📍 총 처리된 위치: ${this.stats.totalProcessed}개`);
        console.log(`✅ 전송 성공: ${this.stats.totalSent}개`);
        console.log(`❌ 전송 실패: ${this.stats.totalFailed}개`);
        console.log(`📊 성공률: ${((this.stats.totalSent / this.stats.totalProcessed) * 100).toFixed(1)}%`);
        console.log('======================================');
    }

    /**
     * 지연 함수
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 메인 실행 함수
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('사용법:');
        console.log('  node migrate-position-history.js <파일경로>');
        console.log('  node migrate-position-history.js <디렉토리경로>');
        console.log('');
        console.log('예시:');
        console.log('  node migrate-position-history.js position_log/position_20250913_11.log');
        console.log('  node migrate-position-history.js position_log/');
        process.exit(1);
    }

    const targetPath = args[0];
    const migrator = new PositionMigrator();

    try {
        console.log('🚀 위치정보 마이그레이션 시작');
        console.log(`대상: ${targetPath}`);
        console.log(`API: ${API_CONFIG.SUPABASE_URL}`);
        console.log('');

        const stat = fs.statSync(targetPath);
        
        if (stat.isFile()) {
            await migrator.migrateFile(targetPath);
        } else if (stat.isDirectory()) {
            await migrator.migrateDirectory(targetPath);
        } else {
            throw new Error('유효하지 않은 파일 또는 디렉토리입니다.');
        }

        migrator.printStats();

    } catch (error) {
        console.error('❌ 마이그레이션 실패:', error.message);
        process.exit(1);
    }
}

// 스크립트 직접 실행 시
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PositionMigrator };