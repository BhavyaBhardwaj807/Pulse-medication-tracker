import React, { useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import AgoraUIKit from 'agora-react-uikit';
import medicalHistoryData from './medicalHistory.json';
import EnhancedScanner from './EnhancedScanner';
import './App.css';

function App() {
  const [medications, setMedications] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', time: '', color: '#3b82f6' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [streak, setStreak] = useState(12);
  const [adherenceHistory, setAdherenceHistory] = useState([]);
  const [medicationStats, setMedicationStats] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [opencv, setOpencv] = useState(null);
  const [tesseract, setTesseract] = useState(null);
  const [enhancedScanner, setEnhancedScanner] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [showAgoraVoice, setShowAgoraVoice] = useState(false);
  const [agoraConnected, setAgoraConnected] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState({ email: '', name: '', remindersEnabled: false });
  const [medicalHistory, setMedicalHistory] = useState(medicalHistoryData);

  useEffect(() => {
    const saved = localStorage.getItem('pulse-medications');
    if (saved) {
      setMedications(JSON.parse(saved));
    } else {
      const toyData = [
        { id: 1, name: 'Vitamin D3', dosage: '1000 IU', frequency: 'Once daily', time: '08:00', color: '#f59e0b', taken: true, addedDate: new Date().toISOString() },
        { id: 2, name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', time: '12:00', color: '#10b981', taken: false, addedDate: new Date().toISOString() },
        { id: 3, name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', time: '20:00', color: '#8b5cf6', taken: true, addedDate: new Date().toISOString() },
        { id: 4, name: 'Omega-3', dosage: '1200mg', frequency: 'Once daily', time: '09:00', color: '#06b6d4', taken: true, addedDate: new Date().toISOString() },
        { id: 5, name: 'Aspirin', dosage: '81mg', frequency: 'Once daily', time: '21:00', color: '#ef4444', taken: false, addedDate: new Date().toISOString() }
      ];
      setMedications(toyData);
    }
    const savedStreak = localStorage.getItem('pulse-streak');
    if (savedStreak) setStreak(parseInt(savedStreak));
    
    const savedProfile = localStorage.getItem('pulse-profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
    
    const history = Array.from({length: 7}, (_, i) => {
      const taken = Math.floor(Math.random() * 4) + 2;
      const total = 5;
      return {
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        taken,
        total,
        percentage: Math.round((taken / total) * 100)
      };
    }).reverse();
    setAdherenceHistory(history);
    
    // Generate fixed medication stats
    const savedStats = localStorage.getItem('pulse-med-stats');
    if (!savedStats) {
      const stats = {};
      [1, 2, 3, 4, 5].forEach(id => {
        const expectedDaily = id === 2 ? 2 : id === 3 ? 1 : 1;
        const expectedWeekly = expectedDaily * 7;
        const actualTaken = Math.floor(expectedWeekly * (0.7 + Math.random() * 0.25));
        stats[id] = {
          expectedWeekly,
          actualTaken,
          adherenceRate: Math.round((actualTaken / expectedWeekly) * 100)
        };
      });
      setMedicationStats(stats);
      localStorage.setItem('pulse-med-stats', JSON.stringify(stats));
    } else {
      setMedicationStats(JSON.parse(savedStats));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pulse-medications', JSON.stringify(medications));
  }, [medications]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const addMedication = (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.dosage) return;
    
    const medication = {
      id: Date.now(),
      ...newMed,
      taken: false,
      addedDate: new Date().toISOString(),
      nextDose: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMedications([...medications, medication]);
    
    // Add to Google Calendar if profile is set up
    if (userProfile.email && userProfile.remindersEnabled && medication.time) {
      addToGoogleCalendar(medication);
    }
    
    setNewMed({ name: '', dosage: '', frequency: '', time: '', color: '#3b82f6' });
    setShowAddForm(false);
  };

  const toggleTaken = (id) => {
    setMedications(medications.map(med => {
      if (med.id === id) {
        const newTaken = !med.taken;
        if (newTaken) {
          const newStreak = streak + 1;
          setStreak(newStreak);
          localStorage.setItem('pulse-streak', newStreak.toString());
        }
        return { ...med, taken: newTaken, takenAt: newTaken ? new Date().toISOString() : null };
      }
      return med;
    }));
  };

  const deleteMedication = (id) => {
    setMedications(medications.filter(med => med.id !== id));
  };

  const startVoiceInput = async () => {
    if (agoraConnected) {
      setShowAgoraVoice(true);
      return;
    }
    
    if (!recognition) {
      setShowAgoraVoice(true);
      return;
    }
    
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      alert('Microphone access required for voice input. Please allow microphone access and try again.');
      return;
    }
    
    if (!isListening) {
      setIsListening(true);
      try {
        recognition.start();
      } catch (error) {
        console.error('Speech recognition start error:', error);
        setIsListening(false);
        alert('Voice recognition not available. Please try manual input.');
      }
    }
  };

  const agoraRtcProps = {
    appId: 'e7f6e9aeecf14b2ba10e3f40be9f56e7',
    channel: 'pulse-voice-' + Date.now(),
    token: null
  };

  const agoraCallbacks = {
    EndCall: () => {
      setShowAgoraVoice(false);
      setAgoraConnected(false);
      // Simulate voice processing
      setTimeout(() => {
        const sampleInput = 'Paracetamol 500mg once daily';
        parseSpeechToMedicine(sampleInput);
      }, 1000);
    }
  };

  const parseSpeechToMedicine = (transcript) => {
    console.log('Speech transcript:', transcript);
    const text = transcript.toLowerCase();
    
    // Common medicine names for better recognition
    const commonMedicines = [
      'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
      'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin',
      'losartan', 'gabapentin', 'sertraline', 'tramadol', 'albuterol', 'furosemide',
      'vitamin d', 'vitamin c', 'vitamin b', 'calcium', 'iron', 'magnesium', 'zinc', 'omega'
    ];
    
    let name = '';
    let dosage = '';
    
    // First, try to find known medicine names
    for (const medicine of commonMedicines) {
      if (text.includes(medicine)) {
        name = medicine.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        break;
      }
    }
    
    // Enhanced dosage extraction
    const dosageMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|microgram|milligram|gram|g|ml|milliliter|iu|international\s*unit|unit|tablet|capsule)/i);
    if (dosageMatch) {
      let unit = dosageMatch[2].toLowerCase();
      // Normalize units
      if (unit.includes('microgram')) unit = 'mcg';
      if (unit.includes('milligram')) unit = 'mg';
      if (unit.includes('milliliter')) unit = 'ml';
      if (unit.includes('international') || unit === 'iu') unit = 'IU';
      if (unit.includes('tablet') || unit.includes('capsule')) unit = 'tablet';
      
      dosage = dosageMatch[1] + unit;
    }
    
    // If no known medicine found, extract from speech
    if (!name) {
      const cleanText = text.replace(/\b(add|take|medicine|medication|tablet|capsule|pill|mg|mcg|gram|ml|iu|unit|\d+|once|twice|three|times|daily|morning|evening|night|am|pm|o'clock)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanText.split(' ').filter(word => word.length >= 3);
      
      const excludeWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'each'];
      const validWords = words.filter(word => !excludeWords.includes(word.toLowerCase()));
      
      if (validWords.length >= 1) {
        name = validWords.slice(0, 2).join(' ').split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
    }
    
    // Extract frequency
    let frequency = '';
    if (text.includes('once')) frequency = 'Once daily';
    else if (text.includes('twice')) frequency = 'Twice daily';
    else if (text.includes('three times')) frequency = 'Three times daily';
    
    // Extract time
    const timeMatch = text.match(/(\d{1,2})\s*(am|pm|o\'clock)/i);
    let time = '';
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const period = timeMatch[2].toLowerCase();
      const hour24 = period.includes('pm') && hour !== 12 ? hour + 12 : (period.includes('am') && hour === 12 ? 0 : hour);
      time = hour24.toString().padStart(2, '0') + ':00';
    }
    
    if (name) {
      setNewMed({
        name,
        dosage: dosage || 'Not specified',
        frequency,
        time,
        color: '#3b82f6'
      });
      setShowCamera(false);
      setShowAddForm(true);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Detected ${name}${dosage ? ' ' + dosage : ''}. Please review and save.`);
        speechSynthesis.speak(utterance);
      }
    } else {
      manualMedicineInput(`Could not understand: "${transcript}". Please try saying the medicine name clearly.`);
    }
  };

  const saveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('pulse-profile', JSON.stringify(userProfile));
    setShowProfile(false);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Profile saved. Reminders will be synced to Google Calendar.');
      speechSynthesis.speak(utterance);
    }
  };

  const addToGoogleCalendar = (medication) => {
    const startDate = new Date();
    const [hours, minutes] = medication.time.split(':');
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const endDate = new Date(startDate.getTime() + 15 * 60000); // 15 minutes later
    
    const event = {
      summary: `Take ${medication.name}`,
      description: `Medication: ${medication.name}\nDosage: ${medication.dosage}\nFrequency: ${medication.frequency}`,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      recurrence: getRecurrenceRule(medication.frequency)
    };
    
    // Create Google Calendar URL
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.summary)}&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(event.description)}&recur=${encodeURIComponent(event.recurrence)}`;
    
    window.open(calendarUrl, '_blank');
  };

  const getRecurrenceRule = (frequency) => {
    switch (frequency) {
      case 'Once daily': return 'RRULE:FREQ=DAILY';
      case 'Twice daily': return 'RRULE:FREQ=DAILY;INTERVAL=1';
      case 'Three times daily': return 'RRULE:FREQ=DAILY;INTERVAL=1';
      default: return 'RRULE:FREQ=DAILY';
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      const video = document.getElementById('camera-video');
      if (video) {
        video.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Camera access required for medicine scanning.');
        speechSynthesis.speak(utterance);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const loadLibraries = async () => {
    try {
      // Initialize enhanced scanner
      const scanner = new EnhancedScanner();
      await scanner.initialize();
      setEnhancedScanner(scanner);
      console.log('Enhanced scanner loaded successfully');
      
      // Fallback to Tesseract
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      setTesseract(worker);
      console.log('OCR loaded successfully');
    } catch (err) {
      console.error('Scanner failed to load:', err);
      setTesseract('failed');
    }
  };

  const scanMedicine = async () => {
    setIsScanning(true);
    
    try {
      const video = document.getElementById('camera-video');
      if (!video) {
        throw new Error('Camera not ready');
      }
      
      let result = { name: '', dosage: '' };
      
      // Try enhanced scanner first
      if (enhancedScanner) {
        try {
          result = await enhancedScanner.scanText(video);
          console.log('Enhanced scanner result:', result);
        } catch (error) {
          console.log('Enhanced scanner failed, falling back to Tesseract:', error);
        }
      }
      
      // Fallback to Tesseract if enhanced scanner fails or no result
      if ((!result.name || result.name.length < 3) && tesseract && tesseract !== 'failed') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const { data: { text, confidence } } = await tesseract.recognize(canvas);
        console.log('Tesseract result:', { text, confidence });
        
        if (text && text.trim().length >= 3) {
          result = extractMedicineInfo(text);
        }
      }
      
      if (result.name && result.name.length >= 3) {
        setNewMed({...newMed, name: result.name, dosage: result.dosage || 'Not specified'});
        setIsScanning(false);
        stopCamera();
        setShowCamera(false);
        setShowAddForm(true);
        
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(`Medicine detected: ${result.name}${result.dosage ? ' ' + result.dosage : ''}. Please verify the details.`);
          speechSynthesis.speak(utterance);
        }
      } else {
        manualMedicineInput('Could not detect medicine name. Please ensure the text is clear and well-lit.');
      }
    } catch (error) {
      console.error('Scanning error:', error);
      manualMedicineInput(`Scanning failed: ${error.message}. Please try again or enter manually.`);
    }
  };
  
  const manualMedicineInput = (reason) => {
    setIsScanning(false);
    
    // Provide helpful suggestions
    const suggestions = 'Common medicines: Paracetamol, Ibuprofen, Aspirin, Vitamin D, Metformin, Lisinopril';
    const name = prompt(`${reason}\n\n${suggestions}\n\nEnter medicine name manually:`);
    
    if (name && name.trim()) {
      // Validate and clean the input
      const cleanName = name.trim().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      const dosage = prompt('Enter dosage (e.g., 500mg, 10ml, 2 tablets):') || 'Not specified';
      
      setNewMed({...newMed, name: cleanName, dosage});
      stopCamera();
      setShowCamera(false);
      setShowAddForm(true);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Added ${cleanName} manually. Please review the details.`);
        speechSynthesis.speak(utterance);
      }
    }
  };
  
  const extractMedicineInfo = (text) => {
    console.log('Fallback extracting from:', text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let detectedName = '';
    let detectedDosage = '';
    
    // Extract dosage
    const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|tablets?)/i;
    for (const line of lines) {
      const match = line.match(dosageRegex);
      if (match) {
        detectedDosage = match[1] + match[2].toLowerCase();
        break;
      }
    }
    
    // Extract multi-word medicine name
    const excludeWords = ['tablet', 'capsule', 'syrup', 'mg', 'mcg', 'use', 'take', 'daily'];
    
    for (const line of lines) {
      const cleanLine = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanLine.split(' ').filter(w => w.length >= 2);
      const validWords = words.filter(w => !excludeWords.includes(w.toLowerCase()));
      
      if (validWords.length >= 1) {
        const candidateName = validWords.slice(0, 3).join(' ');
        if (candidateName.length > detectedName.length) {
          detectedName = candidateName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      }
    }
    
    return { name: detectedName, dosage: detectedDosage };
  };

  const processMedicineText = (text) => {
    // Use the enhanced extractMedicineInfo function
    return extractMedicineInfo(text);
  };

  useEffect(() => {
    loadLibraries();
    
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech result:', transcript);
        parseSpeechToMedicine(transcript);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
        } else {
          manualMedicineInput(`Voice recognition failed: ${event.error}`);
        }
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showCamera]);

  const todaysTaken = medications.filter(med => med.taken).length;
  const totalToday = medications.length;
  const completionRate = totalToday > 0 ? Math.round((todaysTaken / totalToday) * 100) : 0;

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="app">
      <div className="animated-bg">
        <div className="pulse-wave"></div>
        <div className="pulse-wave"></div>
        <div className="pulse-wave"></div>
      </div>
      
      <header className="header">
        <div className="header-content">
          <button 
            className="profile-btn-header"
            onClick={() => setShowProfile(true)}
            title="Profile & Settings"
          >
            👤
          </button>
          <div className="logo-container">
            <div className="pulse-icon-animated">💊</div>
            <h1 className="logo">Pulse</h1>
          </div>
          <p className="tagline">Stay ahead of your Meds!!</p>
          <div className="time-display">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card completion">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <h3>Today's Progress</h3>
                <div className="progress-ring">
                  <div className="progress-value">{completionRate}%</div>
                </div>
                <p>{todaysTaken} of {totalToday} taken</p>
              </div>
            </div>
            <div className="stat-card streak">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <h3>Streak</h3>
                <div className="streak-number">{streak}</div>
                <p>doses in a row</p>
              </div>
            </div>
            <div className="stat-card next">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <h3>Next Dose</h3>
                <div className="next-time">
                  {medications.find(m => !m.taken)?.time || '--:--'}
                </div>
                <p>{medications.find(m => !m.taken)?.name || 'All done!'}</p>
              </div>
            </div>
          </div>

          <div className="dashboard">
            <div className="dashboard-header">
              <h2>Today's Medications</h2>
              <div className="header-actions">
                <button 
                  className="scan-btn"
                  onClick={() => setShowCamera(true)}
                >
                  📷🎤 Smart Add
                </button>
                <button 
                  className="report-btn"
                  onClick={() => setShowReport(true)}
                >
                  📊 Report
                </button>
                <button 
                  className="add-btn floating-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  <span className="btn-icon">+</span>
                  Manual Add
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="modal-overlay animate-in" onClick={() => setShowAddForm(false)}>
                <form className="add-form glass-card" onClick={e => e.stopPropagation()} onSubmit={addMedication}>
                  <div className="form-header">
                    <h3>Add New Medication</h3>
                    <button type="button" className="close-btn" onClick={() => setShowAddForm(false)}>×</button>
                  </div>
                  
                  <div className="form-group">
                    <label>💊 Medication Name</label>
                    <input
                      type="text"
                      placeholder="Enter medication name"
                      value={newMed.name}
                      onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>📏 Dosage</label>
                    <input
                      type="text"
                      placeholder="e.g., 10mg, 2 tablets"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>🔄 Frequency</label>
                      <select
                        value={newMed.frequency}
                        onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
                      >
                        <option value="">Select frequency</option>
                        <option value="Once daily">Once daily</option>
                        <option value="Twice daily">Twice daily</option>
                        <option value="Three times daily">Three times daily</option>
                        <option value="As needed">As needed</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>⏰ Time</label>
                      <input
                        type="time"
                        value={newMed.time}
                        onChange={(e) => setNewMed({...newMed, time: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>🎨 Color Theme</label>
                    <div className="color-picker">
                      {colors.map(color => (
                        <button
                          key={color}
                          type="button"
                          className={`color-option ${newMed.color === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewMed({...newMed, color})}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
                    <button type="submit" className="submit-btn">Add Medication</button>
                  </div>
                </form>
              </div>
            )}

            {showReport && (
              <div className="modal-overlay animate-in" onClick={() => setShowReport(false)}>
                <div className="report-modal glass-card" onClick={e => e.stopPropagation()}>
                  <div className="form-header">
                    <h3>📊 Detailed Adherence Report</h3>
                    <button type="button" className="close-btn" onClick={() => setShowReport(false)}>×</button>
                  </div>
                  
                  <div className="report-stats">
                    <div className="report-stat">
                      <div className="stat-number">{Math.round(adherenceHistory.reduce((acc, day) => acc + day.percentage, 0) / adherenceHistory.length)}%</div>
                      <div className="stat-label">Overall Adherence</div>
                    </div>
                    <div className="report-stat">
                      <div className="stat-number">{adherenceHistory.reduce((acc, day) => acc + day.taken, 0)}/{adherenceHistory.reduce((acc, day) => acc + day.total, 0)}</div>
                      <div className="stat-label">Doses Taken</div>
                    </div>
                    <div className="report-stat">
                      <div className="stat-number">{adherenceHistory.reduce((acc, day) => acc + day.total - day.taken, 0)}</div>
                      <div className="stat-label">Missed Doses</div>
                    </div>
                  </div>
                  
                  <div className="medication-breakdown">
                    <h4>📋 Medication Breakdown</h4>
                    <div className="med-list">
                      {medications.map(med => {
                        const stats = medicationStats[med.id] || { expectedWeekly: 7, actualTaken: 5, adherenceRate: 71 };
                        const missedDoses = stats.expectedWeekly - stats.actualTaken;
                        
                        return (
                          <div key={med.id} className="med-breakdown">
                            <div className="med-info">
                              <div className="med-name-dose">
                                <span className="med-name">{med.name}</span>
                                <span className="med-dose">{med.dosage}</span>
                              </div>
                              <div className="med-schedule">{med.frequency} at {med.time}</div>
                            </div>
                            <div className="med-stats">
                              <div className="stat-item">
                                <span className="stat-label">Expected:</span>
                                <span className="stat-value">{stats.expectedWeekly} doses</span>
                              </div>
                              <div className="stat-item">
                                <span className="stat-label">Taken:</span>
                                <span className="stat-value">{stats.actualTaken} doses</span>
                              </div>
                              <div className="stat-item">
                                <span className="stat-label">Missed:</span>
                                <span className="stat-value missed">{missedDoses} doses</span>
                              </div>
                              <div className="stat-item">
                                <span className="stat-label">Adherence:</span>
                                <span className={`stat-value ${stats.adherenceRate >= 80 ? 'good' : stats.adherenceRate >= 60 ? 'fair' : 'poor'}`}>{stats.adherenceRate}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="adherence-chart">
                    <h4>📈 Daily Adherence Trend</h4>
                    <div className="chart-bars">
                      {adherenceHistory.map((day, i) => (
                        <div key={i} className="chart-day">
                          <div className="chart-bar" style={{height: `${day.percentage}%`}}></div>
                          <div className="chart-label">{new Date(day.date).toLocaleDateString('en', {weekday: 'short'})}</div>
                          <div className="chart-value">{day.taken}/{day.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="insights">
                    <h4>💡 Insights & Recommendations</h4>
                    <div className="insight-list">
                      <div className="insight-item">
                        <span className="insight-icon">⏰</span>
                        <span>Most missed doses occur in the evening (8-10 PM)</span>
                      </div>
                      <div className="insight-item">
                        <span className="insight-icon">📱</span>
                        <span>Consider setting phone reminders for better adherence</span>
                      </div>
                      <div className="insight-item">
                        <span className="insight-icon">🎯</span>
                        <span>Your adherence improved by 15% this week - keep it up!</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="medical-history-section">
                    <h4>🏥 Medical History</h4>
                    <div className="patient-info">
                      <div className="patient-header">
                        <span className="patient-name">{medicalHistory.patientName}</span>
                        <span className="patient-dob">DOB: {new Date(medicalHistory.dateOfBirth).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="conditions-list">
                      {medicalHistory.medicalHistory.map((condition, index) => (
                        <div key={index} className="condition-card">
                          <div className="condition-header">
                            <div className="condition-title">
                              <span className="condition-name">{condition.condition}</span>
                              <span className={`condition-status ${condition.status.toLowerCase()}`}>{condition.status}</span>
                            </div>
                            <div className="condition-meta">
                              <span className="diagnosis-info">Diagnosed at age {condition.diagnosedAt} ({new Date(condition.diagnosisDate).getFullYear()})</span>
                              <span className={`severity ${condition.severity.toLowerCase()}`}>{condition.severity}</span>
                            </div>
                          </div>
                          
                          <div className="condition-details">
                            <div className="medicines-section">
                              <h5>💊 Prescribed Medicines:</h5>
                              {condition.prescribedMedicines.map((med, medIndex) => (
                                <div key={medIndex} className="prescribed-med">
                                  <div className="med-name-dosage">
                                    <span className="med-name">{med.name}</span>
                                    <span className="med-dosage">{med.dosage}</span>
                                  </div>
                                  <div className="med-schedule">{med.frequency} - {med.duration}</div>
                                  {med.notes && <div className="med-notes">📝 {med.notes}</div>}
                                </div>
                              ))}
                            </div>
                            
                            {condition.symptoms && (
                              <div className="symptoms-section">
                                <h5>🔍 Symptoms:</h5>
                                <div className="symptoms-list">
                                  {condition.symptoms.map((symptom, symIndex) => (
                                    <span key={symIndex} className="symptom-tag">{symptom}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {condition.notes && (
                              <div className="condition-notes">
                                <strong>📋 Notes:</strong> {condition.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {medicalHistory.allergies && medicalHistory.allergies.length > 0 && (
                      <div className="allergies-section">
                        <h5>⚠️ Allergies:</h5>
                        <div className="allergies-list">
                          {medicalHistory.allergies.map((allergy, index) => (
                            <div key={index} className="allergy-item">
                              <span className="allergen">{allergy.allergen}</span>
                              <span className={`allergy-severity ${allergy.severity.toLowerCase()}`}>{allergy.severity}</span>
                              <span className="allergy-reaction">{allergy.reaction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {medicalHistory.familyHistory && medicalHistory.familyHistory.length > 0 && (
                      <div className="family-history-section">
                        <h5>👨‍👩‍👧‍👦 Family History:</h5>
                        <div className="family-history-list">
                          {medicalHistory.familyHistory.map((family, index) => (
                            <div key={index} className="family-item">
                              <span className="relation">{family.relation}:</span>
                              <span className="family-conditions">{family.conditions.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showCamera && (
              <div className="modal-overlay animate-in" onClick={() => setShowCamera(false)}>
                <div className="camera-modal glass-card" onClick={e => e.stopPropagation()}>
                  <div className="form-header">
                    <h3>📷🎤 Smart Medicine Add</h3>
                    <button type="button" className="close-btn" onClick={() => setShowCamera(false)}>×</button>
                  </div>
                  
                  <div className="smart-add-tabs">
                    <button 
                      className={`tab-btn ${!isListening ? 'active' : ''}`}
                      onClick={() => setIsListening(false)}
                    >
                      📷 Scan
                    </button>
                    <button 
                      className={`tab-btn ${isListening ? 'active' : ''}`}
                      onClick={() => setIsListening(false)}
                    >
                      🎤 Voice
                    </button>
                  </div>
                  
                  <div className="camera-container">
                    <div className="camera-preview">
                      <video 
                        id="camera-video" 
                        autoPlay 
                        playsInline 
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '12px'
                        }}
                      />
                      {isScanning && (
                        <div className="scanning-overlay">
                          <div className="scan-line"></div>
                          <p>🔍 Analyzing medicine...</p>
                          <div className="loading-dots">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      )}
                      {isListening && (
                        <div className="listening-overlay">
                          <div className="voice-animation">
                            <div className="voice-circle"></div>
                            <div className="voice-circle"></div>
                            <div className="voice-circle"></div>
                          </div>
                          <p>🎤 Listening for medicine...</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="scan-controls">
                      <button 
                        className="scan-action-btn"
                        onClick={scanMedicine}
                        disabled={isScanning || !stream}
                      >
                        {isScanning ? 'Scanning...' : '🔍 Scan Medicine'}
                      </button>
                      <button 
                        className="voice-action-btn"
                        onClick={startVoiceInput}
                        disabled={isListening || !recognition}
                      >
                        {isListening ? '🎤 Listening...' : '🎤 Start Voice'}
                      </button>
                      <p className="scan-tip">📷 Point camera directly at medicine name (ensure good lighting) or 🎤 say "Add Paracetamol 500mg"</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showProfile && (
              <div className="modal-overlay animate-in" onClick={() => setShowProfile(false)}>
                <form className="profile-form glass-card" onClick={e => e.stopPropagation()} onSubmit={saveProfile}>
                  <div className="form-header">
                    <h3>👤 Profile & Reminders</h3>
                    <button type="button" className="close-btn" onClick={() => setShowProfile(false)}>×</button>
                  </div>
                  
                  <div className="form-group">
                    <label>📧 Gmail Address</label>
                    <input
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={userProfile.email}
                      onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>👤 Full Name</label>
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={userProfile.remindersEnabled}
                        onChange={(e) => setUserProfile({...userProfile, remindersEnabled: e.target.checked})}
                      />
                      📅 Enable Google Calendar Reminders
                    </label>
                    <p className="reminder-note">When enabled, medication times will be added to your Google Calendar</p>
                  </div>
                  
                  <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => setShowProfile(false)}>Cancel</button>
                    <button type="submit" className="submit-btn">Save Profile</button>
                  </div>
                </form>
              </div>
            )}

            {showAgoraVoice && (
              <div className="modal-overlay animate-in" onClick={() => setShowAgoraVoice(false)}>
                <div className="agora-modal glass-card" onClick={e => e.stopPropagation()}>
                  <div className="form-header">
                    <h3>🎤 Agora Voice Input</h3>
                    <button type="button" className="close-btn" onClick={() => setShowAgoraVoice(false)}>×</button>
                  </div>
                  
                  <div className="agora-container">
                    <AgoraUIKit 
                      rtcProps={agoraRtcProps} 
                      callbacks={agoraCallbacks}
                      styleProps={{
                        localBtnContainer: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
                        maxViewStyles: { height: '200px' }
                      }}
                    />
                    <p className="agora-tip">🎤 Speak clearly: "Add [medicine name] [dosage]"</p>
                  </div>
                </div>
              </div>
            )}

            <div className="medications-grid">
              {medications.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-animation">
                    <div className="floating-pills">
                      <div className="pill">💊</div>
                      <div className="pill">💉</div>
                      <div className="pill">🩺</div>
                    </div>
                  </div>
                  <h3>Ready to start your health journey?</h3>
                  <p>Add your first medication and let Pulse keep you on track</p>
                  <button className="cta-btn" onClick={() => setShowAddForm(true)}>
                    Get Started
                  </button>
                </div>
              ) : (
                medications.map((med, index) => (
                  <div 
                    key={med.id} 
                    className={`med-card ${med.taken ? 'taken' : ''} animate-card`}
                    style={{ 
                      animationDelay: `${index * 0.1}s`,
                      borderLeftColor: med.color || '#3b82f6'
                    }}
                  >
                    <div className="med-header">
                      <div className="med-title">
                        <div className="med-icon" style={{ backgroundColor: med.color || '#3b82f6' }}>💊</div>
                        <h3>{med.name}</h3>
                      </div>
                      <div className="med-actions">
                        <button 
                          className="action-btn edit-btn"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => deleteMedication(med.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    <div className="med-details">
                      <div className="detail-item">
                        <span className="detail-icon">📏</span>
                        <span className="detail-text">{med.dosage}</span>
                      </div>
                      {med.frequency && (
                        <div className="detail-item">
                          <span className="detail-icon">🔄</span>
                          <span className="detail-text">{med.frequency}</span>
                        </div>
                      )}
                      {med.time && (
                        <div className="detail-item">
                          <span className="detail-icon">⏰</span>
                          <span className="detail-text">{med.time}</span>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      className={`take-btn ${med.taken ? 'taken' : ''}`}
                      onClick={() => toggleTaken(med.id)}
                    >
                      <span className="btn-icon">{med.taken ? '✅' : '⭕'}</span>
                      <span className="btn-text">{med.taken ? 'Completed' : 'Take Now'}</span>
                      {med.taken && (
                        <div className="success-animation">
                          <div className="checkmark">✓</div>
                        </div>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;