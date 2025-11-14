import React, { useState, useRef, useEffect } from 'react';

const SimpleScanner = ({ showCamera, setShowCamera, onScanResult }) => {
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showCamera]);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceResult(transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        alert('Voice recognition failed. Please try again.');
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleScan = () => {
    setIsScanning(true);
    // Simulate scanning
    setTimeout(() => {
      setIsScanning(false);
      const name = prompt('Enter medicine name:');
      if (name) {
        const dosage = prompt('Enter dosage:') || 'Not specified';
        onScanResult({ name, dosage });
        setShowCamera(false);
      }
    }, 2000);
  };

  const handleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition not supported');
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  const handleVoiceResult = (transcript) => {
    const text = transcript.toLowerCase();
    let name = '';
    let dosage = '';

    // Simple parsing
    const words = text.split(' ');
    const medicineWords = words.filter(word => 
      !['add', 'take', 'medicine', 'mg', 'tablet', 'daily'].includes(word)
    );
    
    if (medicineWords.length > 0) {
      name = medicineWords[0].charAt(0).toUpperCase() + medicineWords[0].slice(1);
    }

    const dosageMatch = text.match(/(\d+)\s*(mg|tablet|ml)/);
    if (dosageMatch) {
      dosage = dosageMatch[1] + dosageMatch[2];
    }

    if (name) {
      onScanResult({ name, dosage: dosage || 'Not specified' });
      setShowCamera(false);
    } else {
      alert('Could not understand. Please try again.');
    }
  };

  if (!showCamera) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowCamera(false)}>
      <div className="camera-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>📷🎤 Smart Medicine Add</h3>
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
            {isScanning && (
              <div className="scanning-overlay">
                <p>🔍 Scanning...</p>
              </div>
            )}
            {isListening && (
              <div className="listening-overlay">
                <p>🎤 Listening...</p>
              </div>
            )}
          </div>
          
          <div className="scan-controls">
            <button 
              className="scan-action-btn"
              onClick={handleScan}
              disabled={isScanning || !stream}
            >
              {isScanning ? 'Scanning...' : '🔍 Scan Medicine'}
            </button>
            <button 
              className="voice-action-btn"
              onClick={handleVoice}
              disabled={isListening}
            >
              {isListening ? '🎤 Listening...' : '🎤 Start Voice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleScanner;