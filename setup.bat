@echo off
REM FocusTube Interactive Setup Script for Windows

echo ================================================
echo ⚡ FocusTube One-Click Setup (Windows)
echo ================================================

if not exist "server\.env" (
  echo.
  set /p groq_key="🔑 Enter your Groq API Key (get one free at https://console.groq.com): "
  if defined groq_key (
    echo GROQ_API_KEY=%groq_key% > server\.env
    echo PORT=3000 >> server\.env
    echo ✅ Saved GROQ_API_KEY to server\.env
  ) else (
    copy server\.env.example server\.env
    echo ℹ️ Copied server\.env.example to server\.env
  )
)

echo.
echo 📦 Installing server dependencies...
cd server
call npm install
cd ..

echo.
echo 🚀 Starting FocusTube server on http://localhost:3000...
call npm start
