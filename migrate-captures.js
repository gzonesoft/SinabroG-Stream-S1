#!/usr/bin/env node

/**
 * 기존 캡처 파일들을 년/월/일 구조로 이동시키는 스크립트
 */

const fs = require('fs');
const path = require('path');

const baseCaptureDir = '/Users/gzonesoft/api_files/stream/capture';

// 파일명에서 날짜 추출 (capture_streamKey_YYYY-MM-DDTHH-MM-SS-SSSZ.png)
function extractDateFromFilename(filename) {
  const match = filename.match(/capture_.*_(\d{4})-(\d{2})-(\d{2})T/);
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3]
    };
  }
  
  // 파일명에서 날짜를 추출할 수 없으면 파일 생성 시간 사용
  try {
    const filepath = path.join(baseCaptureDir, filename);
    const stats = fs.statSync(filepath);
    const date = new Date(stats.birthtime);
    return {
      year: date.getFullYear().toString(),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      day: String(date.getDate()).padStart(2, '0')
    };
  } catch (error) {
    console.error(`파일 정보 읽기 실패: ${filename}`, error);
    return null;
  }
}

// 파일 이동 함수
function moveFile(filename) {
  const dateInfo = extractDateFromFilename(filename);
  if (!dateInfo) {
    console.warn(`⚠️ 날짜 정보를 추출할 수 없음: ${filename}`);
    return false;
  }
  
  const { year, month, day } = dateInfo;
  const newDir = path.join(baseCaptureDir, year, month, day);
  
  // 디렉토리 생성
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
    console.log(`📁 디렉토리 생성: ${newDir}`);
  }
  
  const oldPath = path.join(baseCaptureDir, filename);
  const newPath = path.join(newDir, filename);
  
  // 파일 이동
  try {
    fs.renameSync(oldPath, newPath);
    console.log(`✅ 이동 완료: ${filename} -> ${year}/${month}/${day}/`);
    return true;
  } catch (error) {
    console.error(`❌ 이동 실패: ${filename}`, error);
    return false;
  }
}

// 메인 실행
function main() {
  console.log('========================================');
  console.log('📦 캡처 파일 구조 마이그레이션 시작');
  console.log('========================================');
  
  if (!fs.existsSync(baseCaptureDir)) {
    console.error(`❌ 캡처 디렉토리가 존재하지 않습니다: ${baseCaptureDir}`);
    return;
  }
  
  // 루트 디렉토리의 파일들만 조회 (이미 년/월/일 구조로 저장된 파일은 제외)
  const files = fs.readdirSync(baseCaptureDir).filter(item => {
    const itemPath = path.join(baseCaptureDir, item);
    return fs.statSync(itemPath).isFile() && 
           (item.endsWith('.png') || item.endsWith('.jpg') || item.endsWith('_metadata.json'));
  });
  
  if (files.length === 0) {
    console.log('ℹ️ 이동할 파일이 없습니다.');
    return;
  }
  
  console.log(`📋 이동할 파일 수: ${files.length}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  // 각 파일 이동
  files.forEach(filename => {
    if (moveFile(filename)) {
      successCount++;
    } else {
      failCount++;
    }
  });
  
  console.log('');
  console.log('========================================');
  console.log('📊 마이그레이션 완료');
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('========================================');
}

// 스크립트 실행
main();