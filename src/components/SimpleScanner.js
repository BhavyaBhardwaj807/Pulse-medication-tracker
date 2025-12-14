import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

const SimpleScanner = ({ showCamera, setShowCamera, onScanResult }) => {
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrWorker, setOcrWorker] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (showCamera) {
      startCamera();
      initOCR();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (ocrWorker) {
        ocrWorker.terminate();
      }
    };
  }, [showCamera]);



  const pickImage = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      return true;
    } catch (err) {
      alert('Camera access denied. Please allow camera permissions.');
      return false;
    }
  };

  const startCamera = () => pickImage();

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const initOCR = async () => {
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-/()%',
        tessedit_pageseg_mode: '6'
      });
      setOcrWorker(worker);
      console.log('OCR initialized successfully');
    } catch (error) {
      console.error('OCR initialization failed:', error);
    }
  };

  const parseMedicationInfo = (ocrText) => {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let bestName = '';
    let strength = '';
    
    // Enhanced strength extraction
    const strengthRegex = /(\d+(?:\.\d+)?)\s*(mg|ml|g|mcg|μg|unit|units|%|iu|tab|tabs|tablet|tablets|cap|caps|capsule|capsules)(\s*\/\s*(ml|day))?/i;
    for (const line of lines) {
      const match = line.match(strengthRegex);
      if (match) {
        strength = match[0].replace(/μg/g, 'mcg');
        break;
      }
    }
    
    // Original working name extraction logic
    const excludeWords = [
      'tablet', 'capsule', 'syrup', 'mg', 'mcg', 'use', 'take', 'daily', 'exp', 'mfg',
      'batch', 'lot', 'date', 'pack', 'strip', 'bottle', 'box', 'label', 'pharma',
      'ltd', 'inc', 'corp', 'company', 'manufacturing', 'manufactured', 'by'
    ];
    
    const commonMedicines = [
      'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
      'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin',
      'losartan', 'gabapentin', 'sertraline', 'tramadol', 'albuterol', 'furosemide',
      'vitamin d', 'vitamin c', 'vitamin b', 'calcium carbonate', 'iron sulfate', 'folic acid'
    ];
    
    // First, look for known medicine names
    const fullText = ocrText.toLowerCase();
    for (const medicine of commonMedicines) {
      if (fullText.includes(medicine)) {
        bestName = medicine.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        break;
      }
    }
    
    // If no known medicine found, extract from lines
    if (!bestName) {
      let candidates = [];
      
      for (const line of lines) {
        const cleanLine = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = cleanLine.split(' ').filter(w => w.length >= 3);
        const validWords = words.filter(w => !excludeWords.includes(w.toLowerCase()));
        
        if (validWords.length >= 1) {
          for (let i = 0; i < validWords.length; i++) {
            candidates.push(validWords[i]);
            if (i < validWords.length - 1) {
              candidates.push(validWords[i] + ' ' + validWords[i + 1]);
            }
            if (i < validWords.length - 2) {
              candidates.push(validWords[i] + ' ' + validWords[i + 1] + ' ' + validWords[i + 2]);
            }
          }
        }
      }
      
      candidates = candidates.filter(c => c.length >= 4);
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length || a.localeCompare(b));
        bestName = candidates[0];
      }
    }
    
    // Format the name properly
    if (bestName) {
      bestName = bestName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    
    return { name: bestName, strength: strength || 'Not specified', instruction: '' };
  };

  const recognizeText = async (canvas) => {
    try {
      const { data: { text } } = await ocrWorker.recognize(canvas);
      console.log('OCR detected text:', text);
      const parsedResult = parseMedicationInfo(text);
      console.log('Parsed result:', parsedResult);
      return { fullText: text, ...parsedResult };
    } catch (error) {
      throw new Error('OCR recognition failed');
    }
  };

  const handleScan = async () => {
    if (!ocrWorker || !videoRef.current) {
      alert('Scanner not ready. Please try again.');
      return;
    }

    setIsScanning(true);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Enhance image for better OCR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const enhanced = gray > 128 ? 255 : 0;
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }
      ctx.putImageData(imageData, 0, 0);
      
      const result = await recognizeText(canvas);
      console.log('Final result:', result);
      
      if (result.name && result.name.trim().length > 0) {
        onScanResult({
          name: result.name,
          dosage: result.strength || 'Not specified',
          strength: result.strength,
          instruction: result.instruction
        });
      } else {
        console.log('No name detected, showing fallback');
        fallbackToManual('Could not detect medicine name from image.');
      }
    } catch (error) {
      console.error('Scanning error:', error);
      fallbackToManual('Scanning failed. Please try again.');
    }
    
    setIsScanning(false);
  };



  const fallbackToManual = (message) => {
    const name = prompt(`${message}\n\nEnter medicine name manually:`);
    if (name && name.trim()) {
      const dosage = prompt('Enter dosage (e.g., 500mg, 2 tablets):') || 'Not specified';
      onScanResult({ 
        name: name.trim().split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' '), 
        dosage 
      });
      setShowCamera(false);
    }
  };



  if (!showCamera) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowCamera(false)}>
      <div className="camera-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>📷 Scan Medicine</h3>
          <button type="button" className="close-btn" onClick={() => setShowCamera(false)}>×</button>
        </div>
        
        <div className="camera-container">
          <div className="camera-preview">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              style={{
                width: '100%',
                height: '300px',
                objectFit: 'cover',
                borderRadius: '12px',
                backgroundColor: '#000'
              }}
            />
            {!stream && (
              <div className="camera-overlay">
                <div className="camera-icon">📷</div>
                <p>Initializing camera...</p>
              </div>
            )}
            {isScanning && (
              <div className="scanning-overlay">
                <div className="scan-line"></div>
                <p>🔍 Analyzing medicine...</p>
                <div className="loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
          </div>
          
          <div className="scan-controls">
            <button 
              className="scan-action-btn"
              onClick={handleScan}
              disabled={isScanning || !stream || !ocrWorker}
            >
              {isScanning ? 'Scanning...' : !ocrWorker ? 'Loading OCR...' : '🔍 Scan Medicine'}
            </button>
            <p className="scan-tip">📷 Point camera directly at medicine name and dosage (ensure good lighting)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleScanner;