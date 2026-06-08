const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (index.html, join.html, CSS, JS)
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// --- Bunker Data (shared between server and clients) ---
const bunkers = [
    { id: 'Academic Bunker Alpha', lat: 25.5340, lon: 84.8530, max_capacity: 1500, strength: 95, current_occupancy: 0 },
    { id: 'Sports Field Bunker', lat: 25.5330, lon: 84.8480, max_capacity: 1000, strength: 80, current_occupancy: 0 },
    { id: 'Main Gate Bunker', lat: 25.5380, lon: 84.8550, max_capacity: 800, strength: 85, current_occupancy: 0 }
];

// --- Live User Tracking ---
const trackedUsers = new Map(); // socketId -> { name, lat, lon, lastUpdate, assignedBunker }

// --- Simulated Users ---
const simulatedUsers = [];

function initSimulatedUsers() {
    const IITP_CENTER = { lat: 25.5358, lon: 84.8511 };
    
    // Add 40 random civilians around campus
    for (let i = 0; i < 40; i++) {
        simulatedUsers.push({
            id: `sim_campus_${i}`,
            name: `Civilian ${i+1}`,
            lat: IITP_CENTER.lat + (Math.random() - 0.5) * 0.015,
            lon: IITP_CENTER.lon + (Math.random() - 0.5) * 0.015,
            isSimulated: true,
            assignedBunker: null
        });
    }

    // Add 20 students per hostel
    const hostels = [
        { id: 'Kalam Hostel', lat: 25.5365, lon: 84.8480 },
        { id: 'Aryabhatta Hostel', lat: 25.5350, lon: 84.8490 },
        { id: 'CV Raman Hostel', lat: 25.5375, lon: 84.8505 }
    ];

    hostels.forEach(h => {
        for (let i = 0; i < 20; i++) {
            simulatedUsers.push({
                id: `sim_${h.id.replace(/\s+/g, '_')}_${i}`,
                name: `Student (${h.id})`,
                lat: h.lat + (Math.random() - 0.5) * 0.002,
                lon: h.lon + (Math.random() - 0.5) * 0.002,
                isSimulated: true,
                assignedBunker: null
            });
        }
    });
}
initSimulatedUsers();

function getAllUsers() {
    const all = {};
    trackedUsers.forEach((u, k) => all[k] = u);
    simulatedUsers.forEach(u => all[u.id] = u);
    return all;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // km
}

function findNearestBunker(lat, lon) {
    let best = null;
    let bestDist = Infinity;
    for (const b of bunkers) {
        if (b.current_occupancy >= b.max_capacity) continue;
        const dist = calculateDistance(lat, lon, b.lat, b.lon);
        if (dist < bestDist) {
            bestDist = dist;
            best = b;
        }
    }
    return best ? { bunker: best, distKm: bestDist } : null;
}

// --- Socket.io Events ---
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // Send current state immediately on connect
    socket.emit('tracking:update', getAllUsers());
    socket.emit('tracking:count', trackedUsers.size + simulatedUsers.length);
    
    // User joins with name and initial GPS
    socket.on('user:join', (data) => {
        const { name, lat, lon } = data;
        trackedUsers.set(socket.id, {
            id: socket.id,
            name: name || 'Unknown',
            lat, lon,
            lastUpdate: Date.now(),
            assignedBunker: null
        });
        console.log(`[JOIN] ${name} at (${lat}, ${lon}) — Total: ${trackedUsers.size}`);

        // Broadcast updated user list to all admin clients
        io.emit('tracking:update', getAllUsers());
        io.emit('tracking:count', trackedUsers.size + simulatedUsers.length);
    });

    // User sends GPS update
    socket.on('user:location', (data) => {
        const user = trackedUsers.get(socket.id);
        if (user) {
            user.lat = data.lat;
            user.lon = data.lon;
            user.lastUpdate = Date.now();

            // Broadcast updated positions to admin
            io.emit('tracking:update', getAllUsers());
        }
    });

    // Admin triggers evacuation
    socket.on('admin:evacuate', () => {
        console.log('[EVACUATE] Admin triggered evacuation!');

        // Reset bunker occupancy
        bunkers.forEach(b => b.current_occupancy = 0);

        const assignments = [];

        const allUsers = getAllUsers();

        Object.entries(allUsers).forEach(([id, user]) => {
            const result = findNearestBunker(user.lat, user.lon);
            if (result) {
                result.bunker.current_occupancy++;
                user.assignedBunker = result.bunker.id;
                const distMeters = Math.round(result.distKm * 1000);

                assignments.push({
                    socketId: id,
                    userName: user.name,
                    bunkerName: result.bunker.id,
                    bunkerLat: result.bunker.lat,
                    bunkerLon: result.bunker.lon,
                    distMeters
                });

                // Send personal evacuation instruction to this user's phone if real
                if (!user.isSimulated) {
                    io.to(id).emit('evacuate:assigned', {
                        bunkerName: result.bunker.id,
                        bunkerLat: result.bunker.lat,
                        bunkerLon: result.bunker.lon,
                        distMeters
                    });
                }
            }
        });

        // Send full assignment list to admin map
        io.emit('evacuate:assignments', {
            assignments,
            bunkers: bunkers.map(b => ({ ...b }))
        });

        // Broadcast updated user data (now with assignedBunker)
        io.emit('tracking:update', getAllUsers());

        console.log(`[EVACUATE] ${assignments.length} users assigned to bunkers.`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        const user = trackedUsers.get(socket.id);
        if (user) {
            console.log(`[DISCONNECT] ${user.name}`);
        }
        trackedUsers.delete(socket.id);
        io.emit('tracking:update', getAllUsers());
        io.emit('tracking:count', trackedUsers.size + simulatedUsers.length);
    });
});

// --- Telegram Notification Endpoint (kept from before) ---
app.post('/api/notify', async (req, res) => {
    const { chatId, bunkerId, distance, isBroadcast, botToken } = req.body;

    if (!chatId || !bunkerId) {
        return res.status(400).json({ error: 'Missing chatId or bunkerId' });
    }

    const tokenToUse = botToken || '8796395695:AAEVYiGBBkQcMJkltnqjdMoAMcsF7PZWxWk';
    const telegramApiUrl = `https://api.telegram.org/bot${tokenToUse}/sendMessage`;

    try {
        let messageBody = '';
        if (req.body.isBroadcast) {
            messageBody = `🚨 EMERGENCY ALERT 🚨\nPlease return to any one of these bunkers immediately:\n*${bunkerId}*\n\n⚠️ Proceed with caution.`;
        } else {
            messageBody = `🚨 EMERGENCY ALERT 🚨\nPlease evacuate to *${bunkerId}* immediately.\n\n📍 Distance: ${Math.round(distance)} meters.\n⚠️ Proceed with caution.`;
        }

        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageBody,
                parse_mode: 'Markdown'
            })
        });

        const data = await response.json();

        if (data.ok) {
            console.log(`Telegram sent successfully to Chat ID: ${chatId}`);
            res.status(200).json({ success: true });
        } else {
            console.error('Telegram API Error:', data.description);
            res.status(400).json({ error: data.description });
        }
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Start Server ---
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  SHELTER COMMAND SERVER`);
    console.log(`  Admin Map:  http://localhost:${PORT}`);
    console.log(`  Join Link:  http://localhost:${PORT}/join.html`);
    console.log(`========================================\n`);
    console.log(`Waiting for connections...`);
});
