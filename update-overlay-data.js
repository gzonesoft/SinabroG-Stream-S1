#!/usr/bin/env node

/**
 * 오버레이 데이터 실시간 업데이트 스크립트
 * 매 5초마다 data_overly.json을 업데이트하여 실시간 데이터 시뮬레이션
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data_overly.json');

// 기본 위치 (서울 시청 근처)
const baseLocation = {
    lat: 37.5665,
    lng: 126.9780,
    alt: 120
};

let currentData = {
    LATITUDE: baseLocation.lat,
    LONGITUDE: baseLocation.lng,
    ALTITUDE: baseLocation.alt,
    SPEED: 0,
    AZIMUTH: 0,
    TILT: 0,
    ROLL: 0
};

// 랜덤 범위 내에서 값 생성
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

// 부드러운 변화를 위한 값 조정
function smoothUpdate(current, target, factor = 0.1) {
    return current + (target - current) * factor;
}

// 데이터 업데이트 함수
function updateOverlayData() {
    try {
        // 위도 변화 (±0.001도 범위)
        const targetLat = baseLocation.lat + randomInRange(-0.001, 0.001);
        currentData.LATITUDE = smoothUpdate(currentData.LATITUDE, targetLat);
        
        // 경도 변화 (±0.001도 범위)
        const targetLng = baseLocation.lng + randomInRange(-0.001, 0.001);
        currentData.LONGITUDE = smoothUpdate(currentData.LONGITUDE, targetLng);
        
        // 고도 변화 (100-200m 범위)
        const targetAlt = randomInRange(100, 200);
        currentData.ALTITUDE = smoothUpdate(currentData.ALTITUDE, targetAlt);
        
        // 속도 변화 (0-25 m/s 범위)
        const targetSpeed = randomInRange(0, 25);
        currentData.SPEED = smoothUpdate(currentData.SPEED, targetSpeed);
        
        // 방위각 변화 (0-360도)
        let targetAzimuth = randomInRange(0, 360);
        // 방위각은 순환값이므로 특별 처리
        if (Math.abs(targetAzimuth - currentData.AZIMUTH) > 180) {
            if (targetAzimuth > currentData.AZIMUTH) {
                targetAzimuth -= 360;
            } else {
                targetAzimuth += 360;
            }
        }
        currentData.AZIMUTH = smoothUpdate(currentData.AZIMUTH, targetAzimuth);
        if (currentData.AZIMUTH < 0) currentData.AZIMUTH += 360;
        if (currentData.AZIMUTH >= 360) currentData.AZIMUTH -= 360;
        
        // 틸트 변화 (-90도 ~ 90도)
        const targetTilt = randomInRange(-15, 15);
        currentData.TILT = smoothUpdate(currentData.TILT, targetTilt);
        
        // 롤 변화 (-45도 ~ 45도)
        const targetRoll = randomInRange(-10, 10);
        currentData.ROLL = smoothUpdate(currentData.ROLL, targetRoll);
        
        // 데이터 정리 (소수점 자릿수)
        const updatedData = {
            LATITUDE: Number(currentData.LATITUDE.toFixed(6)),
            LONGITUDE: Number(currentData.LONGITUDE.toFixed(6)),
            ALTITUDE: Number(currentData.ALTITUDE.toFixed(1)),
            SPEED: Number(currentData.SPEED.toFixed(1)),
            AZIMUTH: Number(currentData.AZIMUTH.toFixed(1)),
            TILT: Number(currentData.TILT.toFixed(1)),
            ROLL: Number(currentData.ROLL.toFixed(1)),
            TIME: new Date().toISOString()
        };
        
        // 파일에 저장
        fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 4));
        
        console.log(`[${new Date().toLocaleTimeString()}] 오버레이 데이터 업데이트됨:`);
        console.log(`  위도: ${updatedData.LATITUDE}`);
        console.log(`  경도: ${updatedData.LONGITUDE}`);
        console.log(`  고도: ${updatedData.ALTITUDE}m`);
        console.log(`  속도: ${updatedData.SPEED}m/s`);
        console.log(`  방위각: ${updatedData.AZIMUTH}°`);
        console.log(`  틸트: ${updatedData.TILT}°`);
        console.log(`  롤: ${updatedData.ROLL}°`);
        console.log('----------------------------------------');
        
    } catch (error) {
        console.error('데이터 업데이트 오류:', error);
    }
}

// 즉시 첫 번째 업데이트 실행
console.log('🚁 DJI 드론 오버레이 데이터 실시간 업데이트 시작');
console.log('========================================');
updateOverlayData();

// 5초마다 업데이트
const updateInterval = setInterval(updateOverlayData, 5000);

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log('\n프로그램을 종료합니다...');
    clearInterval(updateInterval);
    
    // 마지막 업데이트로 정적 데이터 저장
    const finalData = {
        LATITUDE: 37.568890,
        LONGITUDE: 126.978450,
        ALTITUDE: 127.2,
        SPEED: 8.9,
        AZIMUTH: 275.3,
        TILT: -2.1,
        ROLL: 1.5,
        TIME: new Date().toISOString()
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(finalData, null, 4));
    console.log('기본 데이터로 복원완료');
    process.exit(0);
});

console.log('실시간 업데이트 중... (Ctrl+C로 종료)');
