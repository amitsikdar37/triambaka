// IIT Patna Coordinates
const IITP_CENTER = [25.5358, 84.8511];

// Define Map Tile Layers
const tacticalLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

const tacticalDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
});

// Initialize Map
const map = L.map('map', {
    center: IITP_CENTER,
    zoom: 16,
    layers: [tacticalLight]
});

const baseMaps = {
    "Tactical Light": tacticalLight,
    "Tactical Dark": tacticalDark,
    "Satellite View": satellite
};

L.control.layers(baseMaps, null, { collapsed: false, position: 'topright' }).addTo(map);

// --- SOCKET.IO CONNECTION ---
const socket = io();

// --- FIXED REFERENCE POINTS ---
const hostels = [
    { id: 'Kalam Hostel', lat: 25.5365, lon: 84.8480, color: '#ef4444' },
    { id: 'Aryabhatta Hostel', lat: 25.5350, lon: 84.8490, color: '#ef4444' },
    { id: 'CV Raman Hostel', lat: 25.5375, lon: 84.8505, color: '#ef4444' }
];

const bunkers = [
    { id: 'Academic Bunker Alpha', lat: 25.5340, lon: 84.8530, max_capacity: 1500, current_occupancy: 0, color: '#138808' },
    { id: 'Sports Field Bunker', lat: 25.5330, lon: 84.8480, max_capacity: 1000, current_occupancy: 0, color: '#138808' },
    { id: 'Main Gate Bunker', lat: 25.5380, lon: 84.8550, max_capacity: 800, current_occupancy: 0, color: '#138808' }
];

// --- LIVE USER TRACKING ---
const liveUserMarkers = {}; // socketId -> { marker, tooltip }
let routeLines = [];
let isEvacuationActive = false;

// --- TOOLTIP HTML GENERATORS ---
function getHostelTooltipHTML(id, count = 0) {
    const statusText = count > 0 ? "PEOPLE TRAPPED" : "CLEARED";
    const statusClass = count > 0 ? "status-danger" : "status-success";
    return `
        <div class="hud-card hostel-card">
            <div class="hud-header">
                <span class="hud-tag">HOSTEL LOCATION</span>
                <span class="hud-status ${statusClass}">${statusText}</span>
            </div>
            <div class="hud-title">${id}</div>
            <div class="hud-divider"></div>
            <div class="hud-body">
                <div class="hud-row">
                    <span class="hud-label">REMAINING:</span>
                    <span class="hud-value ${statusClass}">${count}</span>
                </div>
            </div>
        </div>
    `;
}

function getBunkerTooltipHTML(id, occupancy, capacity) {
    const pct = Math.min((occupancy / capacity) * 100, 100);
    let statusText = "AVAILABLE";
    let statusClass = "status-success";
    if (pct >= 100) {
        statusText = "FULL CAPACITY";
        statusClass = "status-danger";
    } else if (pct >= 80) {
        statusText = "CRITICAL LIMIT";
        statusClass = "status-warning";
    } else if (pct > 0) {
        statusText = "RECEIVING REFUGEES";
        statusClass = "status-info";
    }
    return `
        <div class="hud-card bunker-card">
            <div class="hud-header">
                <span class="hud-tag">SECURE SHELTER</span>
                <span class="hud-status ${statusClass}">${statusText}</span>
            </div>
            <div class="hud-title">${id}</div>
            <div class="hud-divider"></div>
            <div class="hud-body">
                <div class="hud-row">
                    <span class="hud-label">OCCUPANCY:</span>
                    <span class="hud-value">${occupancy} / ${capacity}</span>
                </div>
                <div class="hud-progress-bar-container">
                    <div class="hud-progress-bar ${statusClass}" style="width: ${pct}%"></div>
                </div>
                <div class="hud-row hud-row-sub">
                    <span class="hud-label-sub">CAPACITY USED</span>
                    <span class="hud-value-sub">${Math.round(pct)}%</span>
                </div>
            </div>
        </div>
    `;
}

function getUserTooltipHTML(name, assignedBunker) {
    const status = assignedBunker ? `→ ${assignedBunker}` : 'Tracking...';
    const statusClass = assignedBunker ? 'status-danger' : 'status-info';
    const statusText = assignedBunker ? 'EVACUATING' : 'ONLINE';
    return `
        <div class="hud-card" style="min-width: 200px;">
            <div class="hud-header">
                <span class="hud-tag">LIVE USER</span>
                <span class="hud-status ${statusClass}">${statusText}</span>
            </div>
            <div class="hud-title" style="font-size: 0.85rem;">${name}</div>
            <div class="hud-divider"></div>
            <div class="hud-body">
                <div class="hud-row">
                    <span class="hud-label">STATUS:</span>
                    <span class="hud-value" style="font-size: 0.75rem; color: ${assignedBunker ? 'var(--error)' : '#63e6be'}">${status}</span>
                </div>
            </div>
        </div>
    `;
}

// --- INIT FIXED MARKERS ---
function initMapMarkers() {
    // Hostels (fixed reference)
    hostels.forEach(h => {
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; width: 40px; cursor: pointer;">
                    <div style="font-size: 20px; background: rgba(0,0,0,0.6); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1.5px solid ${h.color}; box-shadow: 0 0 10px ${h.color};">🏢</div>
                    <div style="color: #e2e2e2; font-size: 9px; font-weight: bold; background: rgba(0,0,0,0.8); padding: 2px 5px; border-radius: 3px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap; letter-spacing: 0.05em; pointer-events: none;">${h.id.toUpperCase()}</div>
                </div>
            `,
            iconSize: [40, 60],
            iconAnchor: [20, 16]
        });
        h.marker = L.marker([h.lat, h.lon], { icon }).addTo(map)
            .bindTooltip(getHostelTooltipHTML(h.id, 0), { permanent: false, direction: 'top', offset: [0, -20], className: 'custom-tooltip' });
    });

    // Bunkers (fixed reference with capacity tracking)
    bunkers.forEach(b => {
        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; width: 40px; cursor: pointer;">
                    <div style="font-size: 24px; background: rgba(0,0,0,0.7); border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border: 2px solid ${b.color}; box-shadow: 0 0 15px ${b.color};">🛡️</div>
                    <div style="color: ${b.color}; font-size: 10px; font-weight: bold; background: rgba(0,0,0,0.9); padding: 3px 6px; border-radius: 4px; margin-top: 5px; border: 1px solid ${b.color}; white-space: nowrap; text-transform: uppercase; box-shadow: 0 0 10px ${b.color}40; pointer-events: none;">${b.id}</div>
                </div>
            `,
            iconSize: [40, 65],
            iconAnchor: [20, 19]
        });
        b.marker = L.marker([b.lat, b.lon], { icon }).addTo(map)
            .bindTooltip(getBunkerTooltipHTML(b.id, b.current_occupancy, b.max_capacity), { permanent: false, direction: 'bottom', offset: [0, 25], className: 'bunker-tooltip' });
    });
}

initMapMarkers();

// --- DASHBOARD LOGGING ---
function logToDashboard(msg, type = 'normal') {
    const logBox = document.getElementById('log-container');
    const p = document.createElement('p');
    p.className = `log-entry ${type}`;
    p.innerHTML = `<span style="color:#555; font-size:0.7rem;">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    logBox.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
    if (logBox.childElementCount > 100) {
        logBox.removeChild(logBox.firstChild);
    }
}

// --- HANDLE LIVE USER UPDATES FROM SERVER ---
socket.on('tracking:update', (users) => {
    const currentIds = new Set(Object.keys(users));

    // Remove markers for disconnected users
    for (const id of Object.keys(liveUserMarkers)) {
        if (!currentIds.has(id)) {
            map.removeLayer(liveUserMarkers[id].marker);
            delete liveUserMarkers[id];
            logToDashboard(`📴 User disconnected`, 'alert');
        }
    }

    // Add or update markers for connected users
    for (const [id, user] of Object.entries(users)) {
        if (liveUserMarkers[id]) {
            // Update existing marker position
            liveUserMarkers[id].marker.setLatLng([user.lat, user.lon]);
            liveUserMarkers[id].marker.setTooltipContent(getUserTooltipHTML(user.name, user.assignedBunker));
        } else {
            // Create new marker for this user
            const isSim = user.isSimulated;
            const ringColor = isSim ? '168,85,247' : '0,204,255'; // Purple for sim, Cyan for real
            const coreColor = isSim ? '#a855f7' : '#00ccff';

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="position:relative; width:24px; height:24px; display:flex; justify-content:center; align-items:center;">
                        <div style="position:absolute; width:32px; height:32px; border:2px solid rgba(${ringColor},0.6); border-radius:50%; animation: user-gps-pulse 1.5s infinite ease-out;"></div>
                        <div style="width:14px; height:14px; background:${coreColor}; border:2px solid white; border-radius:50%; box-shadow: 0 0 12px rgba(${ringColor},0.7); z-index:2;"></div>
                    </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([user.lat, user.lon], { icon }).addTo(map);
            marker.bindTooltip(getUserTooltipHTML(user.name, user.assignedBunker), {
                permanent: false,
                direction: 'top',
                offset: [0, -15],
                className: 'custom-tooltip'
            });

            liveUserMarkers[id] = { marker, isSimulated: isSim };
            
            if (!isSim) {
                logToDashboard(`📡 <b>${user.name}</b> connected — GPS locked`, 'success');
            }
        }
    }

    // Show live indicator if any users connected
    const liveInd = document.getElementById('live-indicator');
    if (Object.keys(users).length > 0) {
        liveInd.classList.remove('hidden');
    } else {
        liveInd.classList.add('hidden');
    }
});

// Update connected users count
socket.on('tracking:count', (count) => {
    document.getElementById('user-count').textContent = count;
});

// --- EVACUATION LOGIC ---
function triggerEvacuation() {
    const btn = document.getElementById('evacuate-btn');
    btn.disabled = true;
    btn.textContent = '⏳ EVACUATING...';

    logToDashboard('🚨 EVACUATION TRIGGERED — Assigning bunkers to all connected users...', 'alert');

    socket.emit('admin:evacuate');
}

// Receive assignments from server
socket.on('evacuate:assignments', (data) => {
    const { assignments, bunkers: updatedBunkers } = data;

    // Clear old route lines
    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];

    isEvacuationActive = true;

    // Bunker occupancies are now calculated dynamically via proximity loop
    /*
    updatedBunkers.forEach(ub => {
        const local = bunkers.find(b => b.id === ub.id);
        if (local) {
            local.current_occupancy = ub.current_occupancy;
            if (local.marker) {
                local.marker.setTooltipContent(getBunkerTooltipHTML(local.id, local.current_occupancy, local.max_capacity));
            }
        }
    });
    */

    // Draw route lines from each user to their assigned bunker
    assignments.forEach(a => {
        const userEntry = liveUserMarkers[a.socketId];
        if (userEntry) {
            const startLatLng = userEntry.marker.getLatLng();
            const endLatLng = [a.bunkerLat, a.bunkerLon];

            const polyline = L.polyline([
                [startLatLng.lat, startLatLng.lng],
                endLatLng
            ], {
                color: '#ff9933',
                weight: 3,
                dashArray: '8, 12',
                opacity: 0.8,
                lineCap: 'round'
            }).addTo(map);

            routeLines.push(polyline);

            logToDashboard(`→ <b>${a.userName}</b> assigned to <b>${a.bunkerName}</b> (${a.distMeters}m)`);

            // Animate simulated users physically walking to the bunker
            if (userEntry.isSimulated) {
                // Speed up walking (1.5 m/s) by 5x so it takes ~10-40 seconds
                const durationMs = Math.max(5000, (a.distMeters / (1.5 * 5)) * 1000); 
                const startTime = Date.now();
                
                function animateMarker() {
                    const now = Date.now();
                    const progress = Math.min((now - startTime) / durationMs, 1);
                    
                    // easeInOutQuad
                    const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                    
                    const currentLat = startLatLng.lat + (endLatLng[0] - startLatLng.lat) * ease;
                    const currentLng = startLatLng.lng + (endLatLng[1] - startLatLng.lng) * ease;
                    
                    userEntry.marker.setLatLng([currentLat, currentLng]);
                    
                    if (progress < 1) {
                        requestAnimationFrame(animateMarker);
                    }
                }
                requestAnimationFrame(animateMarker);
            }
        }
    });

    logToDashboard(`✅ ${assignments.length} users assigned to bunkers.`, 'success');

    const btn = document.getElementById('evacuate-btn');
    btn.disabled = false;
    btn.textContent = '🚨 EVACUATE ALL';
});

// --- TELEGRAM BROADCAST (kept from before) ---
async function sendTelegramBroadcast() {
    const btn = document.getElementById('send-sms-btn');
    btn.innerText = "SENDING...";
    btn.disabled = true;

    const contacts = [
        { id: "5056826173", token: "8796395695:AAEVYiGBBkQcMJkltnqjdMoAMcsF7PZWxWk" },
        { id: "7220392698", token: "8804249699:AAFXdonMWpo_J04wH8v1B8ZEgJsTUZuMwTc" }
    ];

    const bunkerList = bunkers.map(b => b.id).join(", ");

    try {
        const promises = contacts.map(contact => fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: contact.id,
                botToken: contact.token,
                bunkerId: bunkerList,
                distance: 0,
                isBroadcast: true
            })
        }).then(r => r.json()));

        const results = await Promise.all(promises);
        const allSuccess = results.every(r => r.success);

        if (allSuccess) {
            logToDashboard(`📱 Telegram Broadcast sent to all contacts.`, 'success');
        } else {
            logToDashboard(`📱 Some Telegram alerts failed.`, 'alert');
        }
    } catch (err) {
        logToDashboard(`📱 Server error — could not send Telegram.`, 'alert');
    }

    btn.innerText = "BROADCAST TELEGRAM ALERT";
    btn.disabled = false;
}

// --- DYNAMIC HUD UPDATES ---
setInterval(() => {
    // 1. Hostel Remaining Counts (people within 120m)
    hostels.forEach(h => {
        let remaining = 0;
        Object.values(liveUserMarkers).forEach(userEntry => {
            if (!userEntry.marker) return;
            const latlng = userEntry.marker.getLatLng();
            const dist = L.latLng(latlng.lat, latlng.lng).distanceTo([h.lat, h.lon]);
            if (dist < 120) remaining++;
        });
        if (h.marker) {
            h.marker.setTooltipContent(getHostelTooltipHTML(h.id, remaining));
        }
    });

    // 2. Bunker Occupancy (people within 50m)
    bunkers.forEach(b => {
        let arrived = 0;
        Object.values(liveUserMarkers).forEach(userEntry => {
            if (!userEntry.marker) return;
            const latlng = userEntry.marker.getLatLng();
            const dist = L.latLng(latlng.lat, latlng.lng).distanceTo([b.lat, b.lon]);
            if (dist < 50) arrived++;
        });
        
        b.current_occupancy = arrived;
        if (b.marker) {
            b.marker.setTooltipContent(getBunkerTooltipHTML(b.id, b.current_occupancy, b.max_capacity));
        }
    });
}, 1000);

// --- Add CSS animation for user GPS pulse (injected dynamically) ---
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes user-gps-pulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(1.8); opacity: 0; }
    }
`;
document.head.appendChild(styleSheet);
