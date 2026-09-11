# Chrome Web Store Listing — FocusTube

> Last Updated: 2026-09-11

## Store Listing Metadata

**Extension Name**
FocusTube - YouTube Focus & AI Goal Tracker

**Short Description** (Max 132 chars)
Set session goals, track YouTube focus, and eliminate distractions with AI-powered video relevance classification and analytics.

**Detailed Description**
FocusTube is an intelligent AI focus assistant for YouTube designed to keep your learning and work sessions distraction-free.

FEATURES AT A GLANCE
• Active Session Goal Tracking: Define your session study goal (e.g. "Learn System Design" or "React 19 Tutorial").
• AI Video Relevance Classification: Automatically evaluates YouTube videos in real-time using Groq AI.
• In-Page Smart Nudges: Receives subtle, non-intrusive floating banners when watching relevant videos, and urgent 2-minute distraction alerts when off-track.
• Real-Time Focus Analytics: Computes live focus percentages, on-topic vs. off-topic video ratios, and watched video logs inside the extension popup.
• Full Interactive Dashboard: View past session histories, weekly focus trend bar charts (S1, S2...), overall focus health grades (A+, A-...), and export session logs to CSV.

HOW TO USE IT
1. Open the FocusTube extension popup.
2. Enter your study or work goal (e.g., "Python Data Structures") and click "Start Session".
3. Watch YouTube as usual. FocusTube automatically evaluates active video pages and alerts you if you stray off-topic.
4. Open the Dashboard anytime to review your focus health score, past session summaries, and Groq AI insights.

PRIVACY & PERMISSIONS NOTE
FocusTube evaluates YouTube video titles locally or via secure classification endpoints. No private data is sold or used for advertising.

**Category**
Productivity

**Single Purpose**
Filters YouTube video distractions and tracks session focus scores against user-defined learning goals using AI classification.

**Primary Language**
English

---

## Permissions Justification

| Permission | Type | Justification |
| :--- | :--- | :--- |
| `storage` | `permissions` | Needed to store session goals, live video history, focus scores, and past summaries locally in `chrome.storage.local`. |
| `tabs` | `permissions` | Needed to query active tab title and URL on YouTube watch pages for video title extraction. |
| `activeTab` | `permissions` | Needed to send runtime classification request messages between the extension popup and content script. |
| `https://www.youtube.com/*` | `host_permissions` | Needed for the content script to run on YouTube video pages, extract video titles, and render focus banner notifications. |

---

## Privacy & Data Use Disclosure

**Does the extension collect user data?** Yes (Minimal Session Activity)

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
| :--- | :---: | :---: | :--- | :---: |
| Website Content (Video Titles) | Yes | Yes (Backend AI Classifier) | Classifies video relevance against user goal | No |
| User Activity (Focus Logs) | Yes | No (Local Storage Only) | Renders dashboard analytics & focus scores | No |

**Data Use Certification**:
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for advertising or creditworthiness purposes.

---

## Pre-Publish Deployment Package Checklist

- [x] Extension Zip excludes `node_modules/`, `.git/`, `.env`, and backend server code.
- [x] All manifest icons (`icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`) exist at exact dimensions.
- [x] Backend server deployed to a cloud host (Render, Railway, Heroku, AWS, or Vercel).
- [x] `content.js` and `popup.js` API endpoints configured to production URL.
