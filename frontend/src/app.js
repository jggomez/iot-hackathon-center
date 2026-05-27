import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// REPLACE WITH YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyDjYJPN_IcoziR3YfqDdmdRoajKZTD6FLU",
    authDomain: "lab-iot-493715.firebaseapp.com",
    projectId: "lab-iot-493715",
    storageBucket: "lab-iot-493715.firebasestorage.app",
    messagingSenderId: "998677631520",
    appId: "1:998677631520:web:e8f55be7c63e9fd27fe245"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elements - Selection by class for multi-room support
const tempEls = document.querySelectorAll('.current-temp');
const humEls = document.querySelectorAll('.current-hum');
const syncEls = document.querySelectorAll('.last-sync');
const alarmToggles = document.querySelectorAll('.alarm-toggle');
const detailsBtns = document.querySelectorAll('.details-btn');
const alarmBadges = document.querySelectorAll('.alarm-badge');

// AI Elements
const aiClassNameEls = document.querySelectorAll('.ai-class-name');
const aiClassDescEls = document.querySelectorAll('.ai-class-desc');
const aiConfidenceTextEls = document.querySelectorAll('.ai-confidence-text');
const aiConfidenceBarEls = document.querySelectorAll('.ai-confidence-bar');
const aiIconContainerEls = document.querySelectorAll('.ai-icon-container');
const aiIconEls = document.querySelectorAll('.ai-icon');

// Thermal Stress Elements
const stressCardEls = document.querySelectorAll('.stress-card');
const stressBadgeEls = document.querySelectorAll('.stress-level-badge');
const stressMsgEls = document.querySelectorAll('.stress-msg');
const stressIconContainerEls = document.querySelectorAll('.stress-icon-container');
const stressIconEls = document.querySelectorAll('.stress-icon');
const stressInfoBtns = document.querySelectorAll('.stress-info-btn');

const ALERT_LEVELS = {
    'NORMAL': { 
        name: 'Optimal', 
        color: 'text-green-600', 
        bgColor: 'bg-green-50', 
        borderColor: 'border-green-200',
        badgeBg: 'bg-green-100',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>'
    },
    'WARNING_HIGH_DENSITY': { 
        name: 'High Density', 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-50', 
        borderColor: 'border-yellow-200',
        badgeBg: 'bg-yellow-100',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>'
    },
    'CRITICAL_OVERCROWDING': { 
        name: 'Overcrowded', 
        color: 'text-red-600', 
        bgColor: 'bg-red-50', 
        borderColor: 'border-red-200',
        badgeBg: 'bg-red-100',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>'
    }
};

const AI_CLASSES = {
    0: { 
        name: 'DEEP FOCUS', 
        desc: 'Modo Taller / Concentración', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-50',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>'
    },
    1: { 
        name: 'HIGH ENGAGEMENT', 
        desc: 'Modo Charla / Keynote', 
        color: 'text-orange-600', 
        bgColor: 'bg-orange-50',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>'
    },
    2: { 
        name: 'ROOM EMPTY', 
        desc: 'Modo Vacío o Receso', 
        color: 'text-slate-400', 
        bgColor: 'bg-slate-100',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
    }
};

// Modal Elements
const modal = document.getElementById('history-modal');
const closeModal = document.getElementById('close-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTitle = document.getElementById('modal-title');

const aiModal = document.getElementById('ai-modal');
const closeAiModal = document.getElementById('close-ai-modal');
const closeAiModalBtn = document.getElementById('close-ai-modal-btn');
const aiAnalysisCards = document.querySelectorAll('.ai-analysis-card');

const stressModal = document.getElementById('stress-modal');
const closeStressModal = document.getElementById('close-stress-modal');
const closeStressModalBtn = document.getElementById('close-stress-modal-btn');

let isDeviceOn = false;
let historicalData = [];

// Chart Setup
const ctx = document.getElementById('sensorChart').getContext('2d');
const sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Temperature (°C)',
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                data: [],
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6
            },
            {
                label: 'Humidity (%)',
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                data: [],
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 6
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                display: true,
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 12, weight: '600' }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { font: { weight: '500' } }
            },
            x: {
                grid: { display: false },
                ticks: { font: { weight: '500' } }
            }
        }
    }
});

// Real-time listener
const sensorQuery = query(
    collection(db, "sensor_data"),
    orderBy("timestamp", "desc"),
    limit(50)
);

onSnapshot(sensorQuery, (snapshot) => {
    const data = [];
    snapshot.forEach((doc) => {
        data.push(doc.data());
    });

    if (data.length > 0) {
        const latest = data[0];
        console.log("Latest sensor data received:", latest);
        historicalData = [...data].reverse();
        updateRealtimeUI(latest);
        syncAlarmState(latest.state);
    }
});

function syncAlarmState(state) {
    isDeviceOn = state === 'ON';
    
    // Update Badges
    alarmBadges.forEach(badge => {
        if (isDeviceOn) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    // Update Toggles
    alarmToggles.forEach(toggle => {
        toggle.checked = isDeviceOn;
    });
}

function updateRealtimeUI(latest) {
    const temp = latest.temperature.toFixed(1);
    const hum = latest.humidity.toFixed(1);
    const time = latest.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    tempEls.forEach(el => el.textContent = temp);
    humEls.forEach(el => el.textContent = hum);
    syncEls.forEach(el => el.textContent = time);

    // Update AI UI - Only update if confidence > 80
    const confidence = latest.aiconfidence || 0;

    if (confidence > 80) {
        const aiData = AI_CLASSES[latest.aiclass] || AI_CLASSES[2];

        aiClassNameEls.forEach(el => {
            el.textContent = aiData.name;
            el.className = `ai-class-name text-lg font-bold ${aiData.color}`;
        });
        aiClassDescEls.forEach(el => el.textContent = aiData.desc);
        aiConfidenceTextEls.forEach(el => el.textContent = `${confidence}%`);
        aiConfidenceBarEls.forEach(el => {
            el.style.width = `${confidence}%`;
            el.className = `ai-confidence-bar h-full transition-all duration-500 bg-green-500`;
        });
        aiIconContainerEls.forEach(el => el.className = `ai-icon-container p-3 rounded-xl shadow-sm transition-colors ${aiData.bgColor}`);
        aiIconEls.forEach(el => {
            el.innerHTML = aiData.icon;
            el.setAttribute('class', `ai-icon w-6 h-6 ${aiData.color}`);
        });
    } else {
        console.log(`AI confidence (${confidence}%) is not high enough (>80%) to update classification UI.`);
    }

    // Update Thermal Stress UI
    const rawAlert = latest.alert !== undefined ? latest.alert : 'NORMAL';
    const alertKey = String(rawAlert).toUpperCase();
    
    // Backward compatibility for legacy integer alerts
    const legacyMap = { '0': 'NORMAL', '1': 'WARNING_HIGH_DENSITY', '2': 'CRITICAL_OVERCROWDING' };
    const normalizedKey = legacyMap[alertKey] || alertKey;
    
    const alertData = ALERT_LEVELS[normalizedKey] || ALERT_LEVELS['NORMAL'];
    const stressMsg = latest.msg || "Optimal comfort levels.";

    console.log(`Alert Debug - Raw: ${rawAlert}, Normalized: ${normalizedKey}`, alertData);

    stressCardEls.forEach(el => {
        el.className = `stress-card p-6 rounded-2xl border-2 mb-8 transition-all duration-500 cursor-pointer hover:shadow-md hover:scale-[1.01] ${alertData.bgColor} ${alertData.borderColor}`;
    });

    stressBadgeEls.forEach(el => {
        el.textContent = alertData.name;
        el.className = `stress-level-badge px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${alertData.badgeBg} ${alertData.color}`;
    });

    stressMsgEls.forEach(el => {
        el.textContent = stressMsg;
        el.className = `stress-msg text-sm font-bold leading-tight ${alertData.color}`;
    });

    stressIconContainerEls.forEach(el => {
        el.className = `stress-icon-container p-3 rounded-xl bg-white shadow-sm transition-colors`;
    });

    stressIconEls.forEach(el => {
        el.innerHTML = alertData.icon;
        const shouldPulse = normalizedKey === 'WARNING_HIGH_DENSITY' || normalizedKey === 'CRITICAL_OVERCROWDING';
        el.setAttribute('class', `stress-icon w-6 h-6 ${alertData.color} ${shouldPulse ? 'animate-pulse' : ''}`);
    });
}

function updateChart(data) {
    const labels = data.map(d => d.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const temps = data.map(d => d.temperature);
    const hums = data.map(d => d.humidity);

    sensorChart.data.labels = labels;
    sensorChart.data.datasets[0].data = temps;
    sensorChart.data.datasets[1].data = hums;
    sensorChart.update();
}

// Modal Logic
detailsBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const roomName = e.target.closest('.glass').querySelector('h2').textContent;
        modalTitle.textContent = `${roomName} - Sensor History`;
        updateChart(historicalData);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

const closeHistoryModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
};

closeModal.addEventListener('click', closeHistoryModal);
closeModalBtn.addEventListener('click', closeHistoryModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHistoryModal();
});

// AI Modal Logic
const closeAiExplanationModal = () => {
    aiModal.classList.remove('active');
    document.body.style.overflow = 'auto';
};

aiAnalysisCards.forEach(card => {
    card.addEventListener('click', () => {
        aiModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

closeAiModal.addEventListener('click', closeAiExplanationModal);
closeAiModalBtn.addEventListener('click', closeAiExplanationModal);
aiModal.addEventListener('click', (e) => {
    if (e.target === aiModal) closeAiExplanationModal();
});

// Stress Modal Logic
const closeStressExplanationModal = () => {
    stressModal.classList.remove('active');
    document.body.style.overflow = 'auto';
};

stressInfoBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double trigger if card is also clicked
        stressModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

stressCardEls.forEach(card => {
    card.addEventListener('click', () => {
        stressModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

closeStressModal.addEventListener('click', closeStressExplanationModal);
closeStressModalBtn.addEventListener('click', closeStressExplanationModal);
stressModal.addEventListener('click', (e) => {
    if (e.target === stressModal) closeStressExplanationModal();
});

// Alarm / Remote Control Logic
async function handleToggle(e) {
    const targetState = e.target.checked ? 'ON' : 'OFF';
    
    try {
        alarmToggles.forEach(toggle => toggle.disabled = true);
        
        const response = await fetch('/api/v1/device/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: targetState }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            // Revert toggle state on failure
            e.target.checked = !e.target.checked;
            throw new Error(error.detail || 'Failed to send command');
        }
        
        console.log(`Alarm ${targetState} command sent successfully`);
    } catch (error) {
        console.error("Command error:", error);
        alert(`Error: ${error.message}`);
    } finally {
        alarmToggles.forEach(toggle => toggle.disabled = false);
    }
}

alarmToggles.forEach(toggle => toggle.addEventListener('change', handleToggle));

// Export Logic
const downloadBtn = document.getElementById('download-csv-btn');
downloadBtn.addEventListener('click', async () => {
    try {
        downloadBtn.innerHTML = `
            <svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Generating...</span>
        `;
        downloadBtn.disabled = true;

        const response = await fetch('/api/v1/sensors/export');
        if (!response.ok) throw new Error('Failed to generate export');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'sensor_data.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error("Export error:", error);
        alert("Failed to export reports. Please try again.");
    } finally {
        downloadBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            <span>Export Reports</span>
        `;
        downloadBtn.disabled = false;
    }
});
