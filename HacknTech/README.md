# 🛡️ Project Narad

**A High-Tech, Military-Grade Encrypted Web Communication Platform.**

Built for hackathons and secure communications, **Narad** is a completely server-blind messaging application. It features true **End-to-End Encryption (E2EE)** for both text and voice dictation, ensuring that no one—not even the server hosting the app—can intercept or read your communications.

## 🌟 Why Use Narad?

In an era of data collection and privacy breaches, Narad stands apart:
*   **Zero-Knowledge Architecture:** The central Python server acts as a "dumb pipe." It only routes encrypted gibberish and never possesses the decryption keys.
*   **Browser-Based Crypto:** All encryption (AES-256) happens locally in your browser's JavaScript engine before your data ever touches the network.
*   **No Accounts Required:** Just share the secure URL containing the `#key` with your team. No logins, no databases, no traces.
*   **Tactical Dictation:** Built-in secure voice-to-text transcription. Speak your message, and it is automatically transcribed, encrypted, and sent seamlessly.
*   **Kill Switch:** A "Terminate Link" feature that instantly destroys the connection, wipes the local encryption keys from memory, and erases the chat history from your screen.

## ✨ Features

- **End-to-End Encrypted Text Chat** (AES-256 via CryptoJS)
- **Secure Voice Dictation** (Local Speech-to-Text Transcription via Web Speech API)
- **High-Tech "National Defense" UI** (Glassmorphism, CRT scanlines, Tactical Dark Mode)
- **Decryption Animations** (Hacker-style text reveals)
- **Self-Destruct Kill Switch** (Terminate Link)
- **Cross-Device Local Network Support**

## 🚀 How to Run Locally

### 1. Prerequisites
Make sure you have Python installed on your machine.

### 2. Install Dependencies
Open your terminal in the project folder and run:
```bash
pip install -r requirements.txt
```

### 3. Start the Server
Run the Flask server:
```bash
python app.py
```
The server will start listening on `0.0.0.0:5000`.

### 4. Connect and Chat
*   **Device A:** Open your web browser and go to `http://localhost:5000`.
*   A secure 256-bit cryptographic key will instantly generate in your URL (e.g., `http://localhost:5000/#e4d3c2b1...`).
*   **Device B:** Copy that *entire* URL (including the `#` and the random string) and open it on another device connected to the same Wi-Fi network. *(Note: Replace `localhost` with Device A's IP address, e.g., `http://192.168.1.15:5000/#...`)*.

---
*Built with Flask, Socket.IO, Vanilla JS, and CryptoJS for the [Insert Hackathon Name] Hackathon.*
