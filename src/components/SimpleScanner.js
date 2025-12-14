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
      setOcrWorker(worker);
    } catch (error) {
      console.error('OCR initialization failed:', error);
    }
  };

  const parseMedicationInfo = (ocrText) => {
    // Clean the text
    let cleanedText = ocrText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Strength extraction
    const strengthRegex = /(\d+(\.\d+)?)\s*(mg|ml|g|mcg|unit|%|iu|tab|cap|capsules|tablets)(\s*\/\s*ml)?/i;
    const strengthMatch = cleanedText.match(strengthRegex);
    let strength = '';
    
    if (strengthMatch) {
      strength = strengthMatch[0];
      cleanedText = cleanedText.replace(strengthMatch[0], '[STRENGTH]');
    }
    
    // Instruction extraction
    const instructionRegex = /(take|dose|dosage|directions)\s*(\d+.*\s*(daily|every|as needed|times|hr))/i;
    const instructionMatch = cleanedText.match(instructionRegex);
    const instruction = instructionMatch ? instructionMatch[2] : '';
    
    // Name extraction
    let name = '';
    if (strength) {
      const strengthIndex = cleanedText.indexOf('[STRENGTH]');
      if (strengthIndex > 0) {
        const beforeStrength = cleanedText.substring(0, strengthIndex).trim();
        const words = beforeStrength.split(' ').filter(word => word.length > 2);
        const fillerWords = ['for', 'the', 'and', 'of', 'in', 'with', 'by', 'from', 'to', 'at'];
        const validWords = words.filter(word => !fillerWords.includes(word.toLowerCase()));
        name = validWords.slice(-4).join(' ');
      }
    }
    
    // Fallback name extraction if no strength found
    if (!name) {
      const commonMedicines = [
        'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
        'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin'
      ];
      
      const textLower = cleanedText.toLowerCase();
      for (const medicine of commonMedicines) {
        if (textLower.includes(medicine)) {
          name = medicine;
          break;
        }
      }
    }
    
    // Format name
    if (name) {
      name = name.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    
    return { name, strength, instruction };
  };

  const recognizeText = async (canvas) => {
    try {
      const { data: { text } } = await ocrWorker.recognize(canvas);
      const parsedResult = parseMedicationInfo(text);
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
      
      const result = await recognizeText(canvas);
      
      if (result.name) {
        onScanResult({
          name: result.name,
          dosage: result.strength || 'Not specified',
          instruction: result.instruction
        });
      } else {
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