/**
 * 캡처 파일 관리를 위한 헬퍼 모듈
 */

const fs = require('fs');
const path = require('path');

class CaptureFileHelper {
  constructor(basePath = '/Users/gzonesoft/api_files/stream/capture') {
    this.basePath = basePath;
  }

  /**
   * 모든 캡처 파일을 재귀적으로 찾기
   */
  getAllCaptureFiles() {
    const files = [];
    
    if (!fs.existsSync(this.basePath)) {
      return files;
    }

    // 재귀적으로 디렉토리 탐색
    const scanDirectory = (dir, relativePath = '') => {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relPath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 디렉토리면 재귀 탐색
          scanDirectory(fullPath, relPath);
        } else if (item.endsWith('.png') || item.endsWith('.jpg')) {
          // 이미지 파일이면 추가
          files.push({
            filename: item,
            relativePath: relPath,
            fullPath: fullPath
          });
        }
      });
    };

    scanDirectory(this.basePath);
    return files;
  }

  /**
   * 특정 파일 찾기 (상대 경로 포함)
   */
  findFile(filePathOrName) {
    // 전체 경로인 경우
    const fullPath = path.join(this.basePath, filePathOrName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    // 파일명만으로 검색 (모든 디렉토리에서)
    const allFiles = this.getAllCaptureFiles();
    const found = allFiles.find(f => f.filename === filePathOrName);
    
    return found ? found.fullPath : null;
  }

  /**
   * 메타데이터 파일 경로 가져오기
   */
  getMetadataPath(imagePath) {
    const dir = path.dirname(imagePath);
    const basename = path.basename(imagePath);
    const metadataName = basename.replace(/\.(png|jpg)$/, '_metadata.json');
    return path.join(dir, metadataName);
  }

  /**
   * 캡처 목록 가져오기 (메타데이터 포함)
   */
  getCaptureList() {
    const files = this.getAllCaptureFiles();
    
    return files.map(file => {
      const stats = fs.statSync(file.fullPath);
      const metadataPath = this.getMetadataPath(file.fullPath);
      
      let metadata = {};
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
          console.warn('메타데이터 읽기 실패:', metadataPath);
        }
      }

      return {
        filename: file.filename,
        path: file.relativePath,
        fullPath: file.fullPath,
        fileSize: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        metadata: metadata
      };
    });
  }
}

module.exports = CaptureFileHelper;