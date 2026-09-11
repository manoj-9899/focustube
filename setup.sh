#!/bin/bash
# FocusTube Interactive Setup Script for macOS & Linux

echo "================================================"
echo "⚡ FocusTube One-Click Setup (macOS / Linux)"
echo "================================================"

if [ ! -f "server/.env" ]; then
  echo ""
  read -p "🔑 Enter your Groq API Key (get one free at https://console.groq.com): " groq_key
  if [ -n "$groq_key" ]; then
    echo "GROQ_API_KEY=$groq_key" > server/.env
    echo "PORT=3000" >> server/.env
    echo "✅ Saved GROQ_API_KEY to server/.env"
  else
    cp server/.env.example server/.env
    echo "ℹ️ Copied server/.env.example to server/.env"
  fi
fi

echo ""
echo "📦 Installing server dependencies..."
(cd server && npm install)

echo ""
echo "🚀 Starting FocusTube server on http://localhost:3000..."
npm start
