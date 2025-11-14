import OpenCVProcessor from './OpenCVProcessor';

class EnhancedScanner {
  constructor() {
    this.isInitialized = false;
    this.openCVProcessor = new OpenCVProcessor();
    this.medicineDatabase = [
      'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
      'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin',
      'losartan', 'gabapentin', 'sertraline', 'tramadol', 'albuterol', 'furosemide',
      'pantoprazole', 'hydrochlorothiazide', 'montelukast', 'escitalopram', 'rosuvastatin',
      'trazodone', 'vitamin d', 'vitamin c', 'vitamin b', 'calcium', 'iron', 'magnesium', 'zinc', 'omega 3'
    ];
  }

  async initialize() {
    try {
      await this.openCVProcessor.loadOpenCV();
      this.isInitialized = true;
      console.log('Enhanced scanner with OpenCV initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced scanner:', error);
      this.isInitialized = false;
    }
  }

  preprocessImage(canvas) {
    // Use OpenCV for advanced preprocessing if available
    if (this.openCVProcessor.isLoaded) {
      return this.openCVProcessor.preprocessForOCR(canvas);
    }
    
    // Fallback to basic preprocessing
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const enhanced = gray > 128 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8);
      
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  async scanText(videoElement, tesseractWorker) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!tesseractWorker) {
      throw new Error('Tesseract worker not available');
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      let bestResult = { name: '', dosage: '' };
      
      if (this.openCVProcessor.isLoaded) {
        const textRegions = this.openCVProcessor.detectTextRegions(canvas);
        
        for (let i = 0; i < Math.min(3, textRegions.length); i++) {
          const region = textRegions[i];
          const croppedCanvas = this.openCVProcessor.cropTextRegion(canvas, region);
          this.preprocessImage(croppedCanvas);
          
          const { data: { text } } = await tesseractWorker.recognize(croppedCanvas);
          
          if (text && text.trim().length > 2) {
            const extracted = this.extractMedicineInfo(text);
            if (extracted.name && extracted.name.length > bestResult.name.length) {
              bestResult = extracted;
            }
          }
        }
      }
      
      if (!bestResult.name) {
        this.preprocessImage(canvas);
        const { data: { text } } = await tesseractWorker.recognize(canvas);
        
        if (text && text.trim().length > 2) {
          bestResult = this.extractMedicineInfo(text);
        }
      }
      
      return bestResult;
    } catch (error) {
      console.error('Scan error:', error);
      throw error;
    }
  }

  extractMedicineInfo(text) {
    console.log('Extracting from text:', text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let detectedName = '';
    let detectedDosage = '';
    
    // Extract dosage first
    const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|mcg|μg|g|ml|iu|units?|tablets?)/i;
    for (const line of lines) {
      const match = line.match(dosageRegex);
      if (match) {
        detectedDosage = match[1] + match[2].toLowerCase().replace('μg', 'mcg');
        break;
      }
    }
    
    // Check known medicines first
    const textLower = text.toLowerCase();
    for (const medicine of this.medicineDatabase) {
      if (textLower.includes(medicine)) {
        detectedName = medicine.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        break;
      }
    }
    
    // If no known medicine, find medicine-like words
    if (!detectedName) {
      const excludeWords = [
        'tablet', 'capsule', 'syrup', 'injection', 'cream', 'gel', 'drops', 'solution',
        'use', 'take', 'dose', 'daily', 'twice', 'once', 'morning', 'evening', 'night',
        'pack', 'box', 'bottle', 'strip', 'blister', 'store', 'keep', 'expiry', 'expire',
        'mfg', 'manufactured', 'batch', 'lot', 'pharma', 'pharmaceutical', 'ltd', 'pvt',
        'company', 'corp', 'inc', 'generic', 'brand', 'prescription', 'the', 'and', 'for'
      ];
      
      let bestCandidate = '';
      
      for (const line of lines) {
        const cleanLine = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = cleanLine.split(' ').filter(w => w.length >= 4);
        
        // Look for medicine-like patterns
        for (let i = 0; i < words.length; i++) {
          const word = words[i].toLowerCase();
          
          if (excludeWords.includes(word)) continue;
          
          // Only accept words that are clearly medicine-like
          if (word.length >= 7 || (/[xyz]/.test(word) && word.length >= 5)) {
            bestCandidate = words[i];
            break;
          }
        }
      }
      
      if (bestCandidate) {
        detectedName = bestCandidate.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
    }
    
    console.log('Extracted:', { name: detectedName, dosage: detectedDosage });
    
    return {
      name: detectedName,
      dosage: detectedDosage
    };
  }
  

}

export default EnhancedScanner;