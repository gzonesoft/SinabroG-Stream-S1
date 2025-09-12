#!/usr/bin/env node

/**
 * 위치정보 로그 저장 모듈
 * data_overly.json 파일의 위치정보를 시간별 로그 파일로 저장
 */

const fs = require('fs');
const path = require('path');

class PositionLogger {
    constructor() {
        this.logDir = path.join(__dirname, 'position_log');
        this.dataFile = path.join(__dirname, 'data_overly.json');
        this.currentLogFile = null;
        this.currentHour = null;
        this.lastLoggedData = null; // 마지막 로그 데이터 저장
        
        // 로그 디렉토리 생성
        this.ensureLogDirectory();
    }
    
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
            console.log(`✅ 로그 디렉토리 생성: ${this.logDir}`);
        }
    }
    
    getLogFileName() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        
        return `position_${year}${month}${day}_${hour}.log`;
    }
    
    shouldRotateLog() {
        const currentHour = new Date().getHours();
        if (this.currentHour === null || this.currentHour !== currentHour) {
            this.currentHour = currentHour;
            return true;
        }
        return false;
    }
    
    formatLogEntry(data) {
        const now = new Date();
        const localTime = now.toLocaleString('ko-KR', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // 모든 데이터를 JSON 형식으로 저장
        const logData = {
            timestamp: localTime,
            ...data
        };
        
        return JSON.stringify(logData);
    }
    
    writeLog(data) {
        try {
            // 로그 로테이션 체크
            if (this.shouldRotateLog() || !this.currentLogFile) {
                this.currentLogFile = path.join(this.logDir, this.getLogFileName());
                console.log(`📝 새 로그 파일: ${this.currentLogFile}`);
            }
            
            // 로그 엔트리 포맷팅
            const logEntry = this.formatLogEntry(data);
            
            // 파일에 추가 (줄바꿈 포함)
            fs.appendFileSync(this.currentLogFile, logEntry + '\n');
            
            return true;
        } catch (error) {
            console.error('로그 작성 오류:', error);
            return false;
        }
    }
    
    logPositionData(data) {
        if (!data) {
            console.error('❌ 로그할 데이터가 없습니다.');
            return false;
        }
        
        // 동일한 데이터인지 확인 (TIME 필드가 같으면 중복으로 간주)
        if (this.lastLoggedData && this.lastLoggedData.TIME === data.TIME) {
            // 중복 데이터는 로그하지 않음
            return false;
        }
        
        // 로그 작성
        const result = this.writeLog(data);
        
        // 성공적으로 로그했으면 마지막 데이터 업데이트
        if (result) {
            this.lastLoggedData = { ...data };
        }
        
        return result;
    }
    
    // 파일 모니터링 및 자동 로깅
    startAutoLogging(interval = 5000) {
        console.log(`🚀 위치정보 자동 로깅 시작 (${interval/1000}초 간격)`);
        
        // 초기 로깅
        this.logFromFile();
        
        // 주기적 로깅
        this.loggingInterval = setInterval(() => {
            this.logFromFile();
        }, interval);
        
        // 파일 감시 (변경시 즉시 로깅)
        if (fs.existsSync(this.dataFile)) {
            fs.watchFile(this.dataFile, { interval: 1000 }, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    console.log('📍 데이터 파일 변경 감지');
                    this.logFromFile();
                }
            });
        }
    }
    
    logFromFile() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                if (this.logPositionData(data)) {
                    const logInfo = `LAT=${data.LATITUDE}, LON=${data.LONGITUDE}`;
                    const extraInfo = data.BATTERY_LEVEL ? `, BAT=${data.BATTERY_LEVEL}%` : '';
                    console.log(`✓ 위치정보 로깅 완료: ${logInfo}${extraInfo}`);
                }
            }
        } catch (error) {
            console.error('파일 읽기 오류:', error);
        }
    }
    
    stopAutoLogging() {
        if (this.loggingInterval) {
            clearInterval(this.loggingInterval);
            fs.unwatchFile(this.dataFile);
            console.log('⏹ 자동 로깅 중지');
        }
    }
    
    // 로그 파일 정리 (오래된 파일 삭제)
    cleanOldLogs(daysToKeep = 7) {
        const now = Date.now();
        const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
        
        try {
            const files = fs.readdirSync(this.logDir);
            let deletedCount = 0;
            
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        console.log(`🗑 오래된 로그 삭제: ${file}`);
                    }
                }
            });
            
            if (deletedCount > 0) {
                console.log(`✓ ${deletedCount}개의 오래된 로그 파일 삭제됨`);
            }
        } catch (error) {
            console.error('로그 정리 오류:', error);
        }
    }
}

// 모듈로 사용하거나 직접 실행
if (require.main === module) {
    // 직접 실행시 자동 로깅 시작
    const logger = new PositionLogger();
    
    console.log('================================');
    console.log('📍 위치정보 로거 시작');
    console.log('================================');
    
    // 자동 로깅 시작 (5초 간격)
    logger.startAutoLogging(5000);
    
    // 매일 자정에 오래된 로그 정리
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
            logger.cleanOldLogs(7); // 7일 이상된 로그 삭제
        }
    }, 60000); // 1분마다 체크
    
    // 프로세스 종료 처리
    process.on('SIGINT', () => {
        console.log('\n로거를 종료합니다...');
        logger.stopAutoLogging();
        process.exit(0);
    });
    
    console.log('로깅 중... (Ctrl+C로 종료)');
} else {
    // 모듈로 export
    module.exports = PositionLogger;
}