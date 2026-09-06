// FocusTube Content Script - Production Build

let currentBannerEl = null;
let autoDismissTimer = null;
let distractionNudgeTimer = null;
let lastClassifiedKey = null;
let titleMutationObserver = null;
const localCache = new Map();

// Verify whether current URL is a standard YouTube watch page
function isYouTubeWatchPage() {
  const path = window.location.pathname;
  return path.startsWith('/watch') && !path.startsWith('/shorts') && !path.startsWith('/results');
}

// Extract current video title from YouTube DOM
function extractVideoTitle() {
  const primaryTitleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata #title h1');
  if (primaryTitleEl && primaryTitleEl.textContent.trim()) {
    return primaryTitleEl.textContent.trim();
  }

  const legacyTitleEl = document.querySelector('h1.title.ytd-video-primary-info-renderer');
  if (legacyTitleEl && legacyTitleEl.textContent.trim()) {
    return legacyTitleEl.textContent.trim();
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.getAttribute('content')) {
    const metaVal = ogTitle.getAttribute('content').trim();
    if (metaVal) return metaVal;
  }

  if (document.title) {
    const cleanTitle = document.title.replace(/ - YouTube$/, '').trim();
    if (cleanTitle && cleanTitle !== 'YouTube') {
      return cleanTitle;
    }
  }

  return null;
}

// Get unique YouTube video ID from URL
function getYouTubeVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('v');
}

// Remove existing notification banner from DOM
function removeExistingBanner() {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
  if (distractionNudgeTimer) {
    clearTimeout(distractionNudgeTimer);
    distractionNudgeTimer = null;
  }
  if (currentBannerEl && currentBannerEl.parentNode) {
    currentBannerEl.parentNode.removeChild(currentBannerEl);
  }
  currentBannerEl = null;
}

// Record video classification result into sessionStats in chrome.storage.local
async function recordVideoClassification(videoKey, videoTitle, status) {
  if (!videoKey || !status) return;
  try {
    const data = await chrome.storage.local.get(['sessionStats', 'sessionGoal']);
    if (!data.sessionGoal) return;

    const stats = data.sessionStats || { onTopicCount: 0, offTopicCount: 0, history: [] };
    if (!stats.history) stats.history = [];

    const existingIndex = stats.history.findIndex(item => item.videoKey === videoKey);

    if (existingIndex !== -1) {
      const prevStatus = stats.history[existingIndex].status;
      if (prevStatus !== status) {
        if (prevStatus === 'on-topic') stats.onTopicCount = Math.max(0, (stats.onTopicCount || 1) - 1);
        if (prevStatus === 'off-topic') stats.offTopicCount = Math.max(0, (stats.offTopicCount || 1) - 1);

        if (status === 'on-topic') stats.onTopicCount = (stats.onTopicCount || 0) + 1;
        if (status === 'off-topic') stats.offTopicCount = (stats.offTopicCount || 0) + 1;

        stats.history[existingIndex].status = status;
        stats.history[existingIndex].videoTitle = videoTitle || stats.history[existingIndex].videoTitle;
        stats.history[existingIndex].timestamp = Date.now();
        await chrome.storage.local.set({ sessionStats: stats });
      }
    } else {
      stats.history.push({ videoKey, videoTitle: videoTitle || 'YouTube Video', status, timestamp: Date.now() });
      if (status === 'on-topic') {
        stats.onTopicCount = (stats.onTopicCount || 0) + 1;
      } else {
        stats.offTopicCount = (stats.offTopicCount || 0) + 1;
      }
      await chrome.storage.local.set({ sessionStats: stats });
    }
  } catch (err) {
    // Fail silently in production
  }
}

// Inject top-right floating banner into YouTube page
function injectBanner({ status, reason, goal }) {
  removeExistingBanner();

  const isOffTopic = status === 'off-topic';

  const banner = document.createElement('div');
  banner.id = 'focustube-injected-banner';
  banner.setAttribute('data-status', status);

  Object.assign(banner.style, {
    position: 'fixed',
    top: '72px',
    right: '24px',
    left: 'auto',
    transform: 'none',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: isOffTopic ? '10px 16px' : '8px 14px',
    backgroundColor: isOffTopic ? '#1E1E2E' : '#0F172A',
    color: '#F8FAFC',
    border: isOffTopic ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '12px',
    boxShadow: isOffTopic 
      ? '0 10px 30px -5px rgba(239, 68, 68, 0.35)' 
      : '0 8px 20px -4px rgba(16, 185, 129, 0.25)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    backdropFilter: 'blur(12px)',
    webkitBackdropFilter: 'blur(12px)',
    maxWidth: '380px',
    width: 'auto',
    animation: 'ftSlideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
  });

  if (!document.getElementById('focustube-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'focustube-style';
    styleEl.textContent = `
      @keyframes ftSlideInRight {
        from { transform: translateX(50px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes ftPulseAlert {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        50% { transform: scale(1.02); box-shadow: 0 0 25px 8px rgba(239, 68, 68, 0.5); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      #focustube-injected-banner button:hover {
        background: rgba(255, 255, 255, 0.2) !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const iconSvg = isOffTopic
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" style="flex-shrink:0;"><path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="#10B981" style="flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;

  const contentText = isOffTopic
    ? `<div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 600; color: #FCA5A5;">⚠️ This looks off-track. Is this what you came for?</span>
        <span style="font-size: 11px; color: #94A3B8;">Goal: "${goal}" — ${reason}</span>
       </div>`
    : `<div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-weight: 600; color: #6EE7B7;">On Track</span>
        <span style="font-size: 12px; color: #CBD5E1;">• ${reason}</span>
       </div>`;

  const dismissBtnHtml = isOffTopic
    ? `<button id="ft-dismiss-btn" style="
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #F8FAFC;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        margin-left: 6px;
        flex-shrink: 0;
      ">Dismiss</button>`
    : '';

  banner.innerHTML = `${iconSvg}${contentText}${dismissBtnHtml}`;
  document.body.appendChild(banner);
  currentBannerEl = banner;

  if (isOffTopic) {
    const dismissBtn = banner.querySelector('#ft-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        removeExistingBanner();
      });
    }

    distractionNudgeTimer = setTimeout(() => {
      triggerDistractionNudge(goal);
    }, 120000); // 2 minutes
  }

  const dismissDelay = isOffTopic ? 10000 : 5000;
  autoDismissTimer = setTimeout(() => {
    if (!isOffTopic && currentBannerEl) {
      removeExistingBanner();
    }
  }, dismissDelay);
}

// Trigger urgent Smart Nudge after 2 minutes on off-topic video
function triggerDistractionNudge(goal) {
  removeExistingBanner();

  const banner = document.createElement('div');
  banner.id = 'focustube-injected-banner';
  banner.style.animation = 'ftPulseAlert 1.5s infinite';

  Object.assign(banner.style, {
    position: 'fixed',
    top: '72px',
    right: '24px',
    left: 'auto',
    transform: 'none',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    backgroundColor: '#3B0764',
    color: '#F8FAFC',
    border: '2px solid #C084FC',
    borderRadius: '14px',
    boxShadow: '0 0 30px 5px rgba(192, 132, 252, 0.4)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    maxWidth: '380px'
  });

  banner.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#E9D5FF" style="flex-shrink:0;">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <span style="font-size: 13px; font-weight: 700; color: #F5D0FE;">⏰ Distraction Alert (2+ mins)</span>
      <span style="font-size: 11px; color: #E9D5FF;">Remember your goal: "${goal}". Ready to switch back?</span>
    </div>
    <button id="ft-nudge-dismiss" style="
      background: #9333EA;
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 8px;
      flex-shrink: 0;
    ">Got It</button>
  `;

  document.body.appendChild(banner);
  currentBannerEl = banner;

  const dismissBtn = banner.querySelector('#ft-nudge-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      removeExistingBanner();
    });
  }
}

// Perform AI classification request to Express backend
async function classifyCurrentVideo(force = false) {
  // Strict URL scoping: ONLY classify on /watch pages (excluding homepage, /shorts, /results)
  if (!isYouTubeWatchPage()) {
    removeExistingBanner();
    return;
  }

  const videoId = getYouTubeVideoId();

  const { sessionGoal } = await chrome.storage.local.get(['sessionGoal']);
  if (!sessionGoal) {
    removeExistingBanner();
    return;
  }

  const videoTitle = extractVideoTitle();
  if (!videoTitle) return;

  const videoKey = videoId || videoTitle;
  const cacheKey = `${videoKey}_${sessionGoal}`;

  if (!force && lastClassifiedKey === cacheKey) {
    return;
  }

  if (!force && localCache.has(cacheKey)) {
    const cachedData = localCache.get(cacheKey);
    lastClassifiedKey = cacheKey;
    await recordVideoClassification(videoKey, videoTitle, cachedData.status);
    injectBanner({
      status: cachedData.status,
      reason: cachedData.reason,
      goal: sessionGoal
    });
    return;
  }

  lastClassifiedKey = cacheKey;

  try {
    const response = await fetch('http://localhost:3000/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: sessionGoal, videoTitle })
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data && data.status) {
      localCache.set(cacheKey, data);
      await recordVideoClassification(videoKey, videoTitle, data.status);

      injectBanner({
        status: data.status,
        reason: data.reason || '',
        goal: sessionGoal
      });
    }
  } catch (err) {
    // Fail silently in production if server is unreachable
  }
}

// Trigger classification on video change
function scheduleClassification(force = false) {
  if (!isYouTubeWatchPage()) {
    removeExistingBanner();
    return;
  }

  setupMutationObserver();

  setTimeout(() => {
    classifyCurrentVideo(force);
  }, 1000);
}

// Observe title DOM mutations for SPA transitions
function setupMutationObserver() {
  if (titleMutationObserver) return;
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleMutationObserver = new MutationObserver(() => {
      scheduleClassification(true);
    });
    titleMutationObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
}

// Observe YouTube SPA navigation events
window.addEventListener('yt-navigate-finish', () => scheduleClassification(true));
window.addEventListener('popstate', () => scheduleClassification(true));

// Initial execution on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupMutationObserver();
  scheduleClassification(true);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setupMutationObserver();
    scheduleClassification(true);
  });
}

// Listen for runtime messages from extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_VIDEO_TITLE') {
    const isWatch = isYouTubeWatchPage();
    const title = isWatch ? extractVideoTitle() : null;

    sendResponse({
      isWatchPage: isWatch,
      title,
      url: window.location.href
    });
  } else if (request.action === 'TRIGGER_CLASSIFY') {
    classifyCurrentVideo(true);
    sendResponse({ status: 'scheduled' });
  }
  return true;
});
