# 🚀 FocusTube Setup Guide (Windows, macOS & Linux)

This guide provides simple, step-by-step instructions to set up and run FocusTube on **Windows**, **macOS**, and **Linux**, including an easy way to configure your Groq API key at startup.

---

## 🔑 Step 1: Get a Free Groq API Key (1 Minute)

FocusTube uses Groq AI for real-time video classification and session insights.

1. Go to [https://console.groq.com](https://console.groq.com).
2. Sign in or create a free account.
3. Navigate to **API Keys** $\rightarrow$ Click **Create API Key**.
4. Copy your key (starts with `gsk_...`).

---

## ⚡ Step 2: One-Click Interactive Setup (Recommended)

FocusTube includes automated setup scripts that prompt for your Groq API key and configure everything for you.

### 🪟 Windows
1. Double-click `setup.bat` (or open Command Prompt in the project folder and run `setup.bat`).
2. Paste your Groq API key when prompted.
3. The script will automatically create `server/.env`, install dependencies, and start the server on `http://localhost:3000`.

### 🍏 macOS & 🐧 Linux
1. Open Terminal in the project folder.
2. Run:
   ```bash
   ./setup.sh
   ```
3. Paste your Groq API key when prompted.
4. The script will automatically configure `server/.env`, install dependencies, and start the server.

---

## 🛠️ Step 3: Manual Startup Options by Operating System

If you prefer starting the server manually or passing the Groq API key directly at startup:

### 🪟 Windows (Command Prompt)
```cmd
set GROQ_API_KEY=gsk_your_actual_key_here && npm start
```

### 🪟 Windows (PowerShell)
```powershell
$env:GROQ_API_KEY="gsk_your_actual_key_here"; npm start
```

### 🍏 macOS / 🐧 Linux (Bash or Zsh)
```bash
GROQ_API_KEY=gsk_your_actual_key_here npm start
```

---

## 📁 Permanent Configuration via `.env` File

You can also save your API key permanently so you don't need to type it every time:

1. Navigate to the `server/` directory.
2. Create or edit the `.env` file:
   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   PORT=3000
   ```
3. Run `npm start` anytime from the root or `server/` directory!

---

## 🧩 Step 4: Load the Extension into Google Chrome

1. Open Google Chrome and go to `chrome://extensions` in your address bar.
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `FocusTube` project folder (or unzipped extension folder).
5. **Done!** Click the FocusTube extension icon in your Chrome toolbar to start tracking your focus sessions.

---

## 🛠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"FocusTube server not running"** | Ensure the backend server is running on `http://localhost:3000` via `npm start` or `setup.sh`/`setup.bat`. |
| **"GROQ_API_KEY not configured" warning** | Verify your Groq API key is correctly saved in `server/.env` or passed via environment variables. |
| **Node.js not recognized** | Download and install Node.js (LTS version) from [https://nodejs.org](https://nodejs.org). |
