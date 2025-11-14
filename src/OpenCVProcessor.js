class OpenCVProcessor {
  constructor() {
    this.cv = null;
    this.isLoaded = false;
  }

  async loadOpenCV() {
    return new Promise((resolve, reject) => {
      if (window.cv && window.cv.Mat) {
        this.cv = window.cv;
        this.isLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
      script.async = true;
      
      script.onload = () => {
        window.cv.onRuntimeInitialized = () => {
          this.cv = window.cv;
          this.isLoaded = true;
          console.log('OpenCV loaded successfully');
          resolve();
        };
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load OpenCV'));
      };
      
      document.head.appendChild(script);
    });
  }

  preprocessForOCR(canvas) {
    if (!this.isLoaded) {
      console.warn('OpenCV not loaded, skipping preprocessing');
      return canvas;
    }

    try {
      const cv = this.cv;
      
      // Convert canvas to OpenCV Mat
      const src = cv.imread(canvas);
      const dst = new cv.Mat();
      const gray = new cv.Mat();
      const binary = new cv.Mat();
      const denoised = new cv.Mat();
      
      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Denoise
      cv.fastNlMeansDenoising(gray, denoised, 10, 7, 21);
      
      // Enhance contrast using CLAHE
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(denoised, dst);
      
      // Adaptive threshold for better text detection
      cv.adaptiveThreshold(dst, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
      
      // Morphological operations to clean up
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
      cv.morphologyEx(binary, dst, cv.MORPH_CLOSE, kernel);
      
      // Convert back to canvas
      cv.imshow(canvas, dst);
      
      // Cleanup
      src.delete();
      dst.delete();
      gray.delete();
      binary.delete();
      denoised.delete();
      kernel.delete();
      clahe.delete();
      
      return canvas;
    } catch (error) {
      console.error('OpenCV preprocessing error:', error);
      return canvas;
    }
  }

  detectTextRegions(canvas) {
    if (!this.isLoaded) {
      return [];
    }

    try {
      const cv = this.cv;
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const binary = new cv.Mat();
      
      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      // Binary threshold
      cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      
      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      const textRegions = [];
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);
        
        // Filter by size - likely text regions
        if (rect.width > 20 && rect.height > 10 && rect.width < canvas.width * 0.8) {
          textRegions.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      }
      
      // Cleanup
      src.delete();
      gray.delete();
      binary.delete();
      contours.delete();
      hierarchy.delete();
      
      return textRegions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } catch (error) {
      console.error('Text region detection error:', error);
      return [];
    }
  }

  cropTextRegion(canvas, region) {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = region.width;
    croppedCanvas.height = region.height;
    
    const ctx = croppedCanvas.getContext('2d');
    ctx.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    
    return croppedCanvas;
  }
}

export default OpenCVProcessor;