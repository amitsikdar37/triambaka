const socket = io();

// DOM Elements
const roomDisplay = document.getElementById('room-id-display');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const dictateBtn = document.getElementById('dictate-btn');
const terminateBtn = document.getElementById('terminate-btn');
const statusDot = document.querySelector('.status-dot');

// State
let room = '';
let cryptoKey = null;

// ==========================================
// 1. CRYPTO ENGINE (Crypto-JS AES-256)
// Using CryptoJS allows encryption to work over regular HTTP (Wi-Fi)
// ==========================================

function initializeCrypto() {
    let hash = window.location.hash.substring(1);
    
    // If no key in URL, generate a highly secure random 256-bit key
    if (!hash) {
        hash = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
        window.location.hash = hash; 
    }
    
    cryptoKey = hash; // Store our secret key
    room = hash.substring(0, 10); // Use the first 10 characters as the room ID
    
    roomDisplay.textContent = room;
    socket.emit('join_chat', { room: room });
}

async function encryptMessage(text) {
    // CryptoJS automatically generates a random IV and salts the encryption
    const ciphertext = CryptoJS.AES.encrypt(text, cryptoKey).toString();
    return {
        ciphertext: ciphertext,
        iv: '' // Handled internally by CryptoJS
    };
}

async function decryptMessage(ciphertext, iv) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, cryptoKey);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!plaintext) throw new Error("Invalid");
        return plaintext;
    } catch (e) {
        return "[Decryption Error: Invalid Key or Corrupt Data]";
    }
}

// ==========================================
// 2. TEXT CHAT DOM LOGIC
// ==========================================

function appendMessage(text, type, isEncryptedPreview = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    if (isEncryptedPreview) {
        bubble.style.fontFamily = 'monospace';
        bubble.style.color = 'var(--alert-red)';
        bubble.style.borderColor = 'var(--alert-red)';
        bubble.textContent = "DECRYPTING_DATA:: " + text.substring(0, 15) + "...";
    } else {
        bubble.textContent = text;
    }
    
    const time = document.createElement('div');
    time.className = 'msg-timestamp';
    time.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    return bubble;
}

async function sendMessage() {
    if (!cryptoKey) return; 
    const text = messageInput.value.trim();
    if (!text) return;
    
    messageInput.value = '';
    appendMessage(text, 'msg-self');
    
    const encrypted = await encryptMessage(text);
    socket.emit('encrypted_message', { room: room, ciphertext: encrypted.ciphertext, iv: encrypted.iv });
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

socket.on('receive_encrypted_message', async (data) => {
    const bubble = appendMessage(data.ciphertext, 'msg-other', true);
    const plaintext = await decryptMessage(data.ciphertext, data.iv);
    
    setTimeout(() => {
        bubble.style.fontFamily = 'inherit';
        bubble.style.color = 'inherit';
        bubble.style.borderColor = 'inherit';
        bubble.textContent = plaintext;
    }, 600); 
});

socket.on('system_message', (data) => {
    const sysMsg = document.createElement('div');
    sysMsg.className = 'system-msg';
    sysMsg.textContent = `[SYSTEM]: ${data.msg}`;
    chatWindow.appendChild(sysMsg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});


// ==========================================
// 3. VOICE DICTATION LOGIC (Web Speech API)
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isButtonHeld = false;

// Prevent context menu and selection on the button for mobile hold
dictateBtn.style.userSelect = 'none';
dictateBtn.style.webkitUserSelect = 'none';
dictateBtn.style.webkitTouchCallout = 'none';

function updateDictateBtnState(recording) {
    if (recording) {
        dictateBtn.classList.remove('voice-idle');
        dictateBtn.classList.add('voice-recording');
        dictateBtn.innerHTML = '<span class="radar-icon">🎙️</span> RECORDING...';
    } else {
        dictateBtn.classList.remove('voice-recording');
        dictateBtn.classList.add('voice-idle');
        dictateBtn.innerHTML = '<span class="radar-icon">🎙️</span> HOLD TO DICTATE';
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Mobile-friendly: continuous=true is buggy on Android/iOS
    recognition.interimResults = false;
    
    recognition.onstart = function() {
        updateDictateBtnState(true);
    };
    
    recognition.onresult = async function(event) {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
            const formattedMsg = `[VOICE TRANSCRIPT]: ${transcript}`;
            appendMessage(formattedMsg, 'msg-self');
            const encrypted = await encryptMessage(formattedMsg);
            socket.emit('encrypted_message', { room: room, ciphertext: encrypted.ciphertext, iv: encrypted.iv });
        }
    };
    
    recognition.onend = function() {
        // If button is still held down, start it again immediately (seamless continuous recording)
        if (isButtonHeld) {
            try {
                recognition.start();
            } catch(e) {
                updateDictateBtnState(false);
            }
        } else {
            updateDictateBtnState(false);
        }
    };
    
    recognition.onerror = function(event) {
        if (event.error === 'not-allowed') {
            alert("Microphone access denied. Please allow microphone permissions and ensure you are using HTTPS.");
            isButtonHeld = false;
        } else if (event.error === 'network') {
            alert("Network error occurred. The Web Speech API requires an internet connection.");
            isButtonHeld = false;
        } else if (event.error !== 'no-speech' && event.error !== 'no-match') {
            console.warn("Speech recognition error: " + event.error);
        }
        updateDictateBtnState(false);
    };
} else {
    dictateBtn.style.display = 'none';
}

let isTouchDevice = false;

function startDictation(e) {
    if (e.type === 'touchstart') isTouchDevice = true;
    if (e.type === 'mousedown' && isTouchDevice) return; // Prevent double firing
    
    if (!window.isSecureContext) {
        alert("Voice dictation requires a secure connection (HTTPS or localhost). Please ensure you are using the 'https://' version of your ngrok link.");
        return;
    }
    if (recognition && cryptoKey) {
        if (!isButtonHeld) {
            isButtonHeld = true;
            try {
                recognition.start();
            } catch(e) {
                console.error("Recognition already started or error:", e);
            }
        }
    } else if (!SpeechRecognition) {
        alert("Your browser does not support Voice Dictation. Please use Chrome or Edge.");
    }
}

function stopDictation(e) {
    if (e.type === 'touchend' || e.type === 'touchcancel') isTouchDevice = true;
    if ((e.type === 'mouseup' || e.type === 'mouseleave') && isTouchDevice) return;
    
    if (isButtonHeld) {
        isButtonHeld = false;
        // The UI updates to idle immediately on 'onend'
        if (recognition) {
            try {
                // Add a small delay before stopping to ensure the last word is fully captured and processed
                setTimeout(() => {
                    if (!isButtonHeld) {
                        recognition.stop();
                    }
                }, 400);
            } catch(e) {}
        }
    }
}

// Push-to-talk event listeners
dictateBtn.addEventListener('mousedown', startDictation);
window.addEventListener('mouseup', stopDictation);

dictateBtn.addEventListener('touchstart', startDictation, {passive: true});
window.addEventListener('touchend', stopDictation, {passive: true});
window.addEventListener('touchcancel', stopDictation, {passive: true});

// Set initial idle text
updateDictateBtnState(false);


// ==========================================
// 4. TERMINATE CONNECTION LOGIC
// ==========================================
terminateBtn.addEventListener('click', () => {
    socket.emit('leave_chat', { room: room });
    socket.disconnect();
    
    window.location.hash = '';
    cryptoKey = null;
    room = '';
    
    chatWindow.innerHTML = `
        <div class="system-msg" style="color: var(--alert-red); font-size: 1.5rem; margin-top: 50px; text-shadow: 0 0 10px var(--alert-red);">
            [!] SYSTEM OFFLINE: CONNECTION SEVERED [!]
        </div>
        <div class="system-msg" style="color: #666; font-size: 0.9rem;">
            Encryption keys destroyed. Data erased from memory.
        </div>
    `;
    
    roomDisplay.textContent = 'TERMINATED';
    statusDot.style.animation = 'none';
    statusDot.style.backgroundColor = 'var(--alert-red)';
    statusDot.style.boxShadow = 'none';
    
    messageInput.disabled = true;
    sendBtn.disabled = true;
    dictateBtn.disabled = true;
    terminateBtn.disabled = true;
});

// Boot up
initializeCrypto();
