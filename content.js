// FocusTube Content Script - Production Build

let currentBannerEl = null;
let autoDismissTimer = null;
let distractionNudgeTimer = null;
let lastClassifiedKey = null;
let titleMutationObserver = null;
const localCache = new Map();

// YouTube Shorts Interception State
let isShortsShieldActive = false;
let shortsShieldEl = null;
let shortsBreakTimer = null;
let shortsBreakEndTime = 0;
let shortsBreakBannerEl = null;
let videoPauseInterval = null;
let lastObservedPath = window.location.pathname;

// Zen Mode (Sidebar Distraction Masking) State
let isZenModeActive = false;
let isZenPeeking = false;
let zenPlaceholderEl = null;
let currentZenGoal = null;
let currentHideComments = true;

// Safely escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Verify whether current URL is a YouTube Shorts page
function isShortsPage() {
  return window.location.pathname.startsWith('/shorts');
}

// Verify whether current URL is a standard YouTube watch page
function isYouTubeWatchPage() {
  const path = window.location.pathname;
  return path.startsWith('/watch') && !path.startsWith('/shorts') && !path.startsWith('/results');
}

// Pause all video elements on the page
function pauseAllVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(v => {
    try {
      if (!v.paused) v.pause();
    } catch (e) {}
  });
}

// Enforce video pause while Shorts Shield is active
document.addEventListener('play', (e) => {
  if (isShortsShieldActive) {
    try {
      e.target.pause();
    } catch (err) {}
  }
}, true);

// Inject or remove CSS rules that hide Shorts carousels, drawers, and shelf items
function updateShortsHiderStyle(shouldHide) {
  let styleEl = document.getElementById('focustube-shorts-hider');
  if (shouldHide) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'focustube-shorts-hider';
      styleEl.textContent = `
        /* Hide Shorts entries in navigation guides */
        ytd-guide-entry-renderer:has(a[href*="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]),
        /* Hide Shorts carousels on homepage and search results */
        ytd-rich-shelf-renderer[is-shorts],
        ytd-reel-shelf-renderer,
        ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
        ytd-browse[page-subtype="home"] ytd-rich-shelf-renderer[is-shorts],
        ytd-search ytd-reel-shelf-renderer {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  } else {
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
  }
}

// Remove Shorts Shield from DOM
function removeShortsShield() {
  isShortsShieldActive = false;
  if (videoPauseInterval) {
    clearInterval(videoPauseInterval);
    videoPauseInterval = null;
  }
  if (shortsShieldEl && shortsShieldEl.parentNode) {
    shortsShieldEl.parentNode.removeChild(shortsShieldEl);
  }
  shortsShieldEl = null;
}

// Remove Shorts Break countdown banner from DOM
function removeShortsBreakBanner() {
  if (shortsBreakTimer) {
    clearInterval(shortsBreakTimer);
    shortsBreakTimer = null;
  }
  if (shortsBreakBannerEl && shortsBreakBannerEl.parentNode) {
    shortsBreakBannerEl.parentNode.removeChild(shortsBreakBannerEl);
  }
  shortsBreakBannerEl = null;
}

// Start temporary 60-second break from Shorts shield
function startShortsBreak(goal) {
  removeShortsShield();
  shortsBreakEndTime = Date.now() + 60000;

  // Unpause videos
  const videos = document.querySelectorAll('video');
  videos.forEach(v => {
    try {
      v.play().catch(() => {});
    } catch (e) {}
  });

  removeShortsBreakBanner();
  const banner = document.createElement('div');
  banner.id = 'focustube-shorts-break-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '72px',
    right: '24px',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    backgroundColor: '#1E1B4B',
    color: '#EDE9FE',
    border: '1px solid rgba(168, 85, 247, 0.6)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    backdropFilter: 'blur(12px)',
    webkitBackdropFilter: 'blur(12px)',
    animation: 'ftSlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  });

  function updateBreakTime() {
    const remaining = Math.max(0, Math.ceil((shortsBreakEndTime - Date.now()) / 1000));
    const countdownEl = banner.querySelector('#ft-break-sec');
    if (countdownEl) countdownEl.textContent = `${remaining}s`;

    if (remaining <= 0) {
      removeShortsBreakBanner();
      handleNavigationChange(true);
    }
  }

  banner.innerHTML = `
    <span>⏳ Shorts Break: <strong id="ft-break-sec">60s</strong> remaining</span>
    <button id="ft-resume-focus-btn" style="
      background: #7C3AED;
      border: none;
      color: white;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    ">Resume Focus</button>
  `;

  document.body.appendChild(banner);
  shortsBreakBannerEl = banner;

  banner.querySelector('#ft-resume-focus-btn')?.addEventListener('click', () => {
    shortsBreakEndTime = 0;
    removeShortsBreakBanner();
    handleNavigationChange(true);
  });

  shortsBreakTimer = setInterval(updateBreakTime, 1000);
}

// Inject high-priority Shorts Shield overlay
function injectShortsShield(goal) {
  if (shortsShieldEl && document.getElementById('focustube-shorts-shield')) {
    return;
  }
  removeExistingBanner();
  removeShortsBreakBanner();

  isShortsShieldActive = true;
  pauseAllVideos();

  if (!videoPauseInterval) {
    videoPauseInterval = setInterval(() => {
      if (isShortsShieldActive && isShortsPage()) {
        pauseAllVideos();
      }
    }, 500);
  }

  if (document.fullscreenElement) {
    try {
      document.exitFullscreen().catch(() => {});
    } catch (e) {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'focustube-shorts-shield';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.94)',
    backdropFilter: 'blur(20px)',
    webkitBackdropFilter: 'blur(20px)',
    padding: '24px',
    boxSizing: 'border-box'
  });

  overlay.innerHTML = `
    <div style="
      max-width: 460px;
      width: 100%;
      background: #111827;
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(239, 68, 68, 0.2);
      padding: 32px 28px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #F8FAFC;
      box-sizing: border-box;
      animation: ftScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <div style="
        width: 56px;
        height: 56px;
        margin: 0 auto 16px auto;
        background: rgba(239, 68, 68, 0.15);
        border: 2px solid rgba(239, 68, 68, 0.5);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#EF4444">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      </div>

      <div style="
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #F87171;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.25);
        padding: 4px 10px;
        border-radius: 20px;
        margin-bottom: 8px;
      ">Shorts Intercepted</div>

      <h2 style="
        margin: 6px 0 10px 0;
        font-size: 22px;
        font-weight: 700;
        color: #FFFFFF;
        letter-spacing: -0.3px;
      ">Focus Session Active</h2>

      <div style="
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 600;
        color: #93C5FD;
        word-break: break-word;
      ">
        🎯 ${escapeHtml(goal)}
      </div>

      <p style="
        margin: 0 0 24px 0;
        font-size: 13px;
        line-height: 1.5;
        color: #94A3B8;
      ">YouTube Shorts break focus and disrupt learning momentum. Take control of your study session.</p>

      <button id="ft-shorts-search-goal" style="
        width: 100%;
        padding: 12px 18px;
        border-radius: 12px;
        background: linear-gradient(135deg, #FF2A55 0%, #A855F7 100%);
        color: #FFFFFF;
        font-weight: 700;
        font-size: 14px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 6px 20px rgba(255, 42, 85, 0.35);
        transition: transform 0.15s, opacity 0.15s;
        margin-bottom: 10px;
      ">🔍 Return to Goal Search</button>

      <div style="display: flex; gap: 10px; width: 100%; margin-bottom: 16px;">
        <button id="ft-shorts-go-back" style="
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #F1F5F9;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">⬅️ Go Back</button>
        <button id="ft-shorts-snooze" style="
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.35);
          color: #E9D5FF;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">⏳ 60s Break</button>
      </div>

      <button id="ft-shorts-end-session" style="
        background: none;
        border: none;
        color: #64748B;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: underline;
        padding: 4px;
      ">End Study Session</button>
    </div>
  `;

  document.body.appendChild(overlay);
  shortsShieldEl = overlay;

  overlay.querySelector('#ft-shorts-search-goal')?.addEventListener('click', () => {
    window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(goal)}`;
  });

  overlay.querySelector('#ft-shorts-go-back')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://www.youtube.com';
    }
  });

  overlay.querySelector('#ft-shorts-snooze')?.addEventListener('click', () => {
    startShortsBreak(goal);
  });

  overlay.querySelector('#ft-shorts-end-session')?.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove(['sessionGoal', 'sessionStartTime', 'sessionStats']);
    } catch (e) {}
    removeShortsShield();
    removeExistingBanner();
  });
}

// Inject or update Zen Mode CSS styles
function updateZenModeStyle(isActive, isPeeking, hideComments) {
  let styleEl = document.getElementById('focustube-zen-style');
  if (!isActive) {
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    return;
  }

  const hideSecondaryRule = !isPeeking 
    ? `
      #secondary #related,
      ytd-watch-next-secondary-results-renderer {
        display: none !important;
      }
    `
    : '';

  const hideCommentsRule = hideComments
    ? `
      #comments,
      ytd-comments {
        display: none !important;
      }
    `
    : '';

  const css = `
    /* Hide distracting end-screen recommendation cards */
    .ytp-ce-element {
      display: none !important;
    }

    ${hideSecondaryRule}
    ${hideCommentsRule}
  `;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'focustube-zen-style';
    (document.head || document.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = css;
}

// Render or update the Zen Focus Shield placeholder inside YouTube's sidebar
function renderZenPlaceholder(goal) {
  if (!goal) return;

  const existingPlaceholder = document.getElementById('focustube-zen-placeholder');
  if (existingPlaceholder) {
    const goalTextEl = existingPlaceholder.querySelector('#ft-zen-goal-text');
    if (goalTextEl) goalTextEl.textContent = `🎯 ${goal}`;
    return;
  }

  const secondaryContainer = document.querySelector('#secondary #secondary-inner, #secondary');
  if (!secondaryContainer) {
    setTimeout(() => {
      if (isZenModeActive && isYouTubeWatchPage()) {
        renderZenPlaceholder(goal);
      }
    }, 400);
    return;
  }

  const card = document.createElement('div');
  card.id = 'focustube-zen-placeholder';
  Object.assign(card.style, {
    backgroundColor: '#0F172A',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '16px',
    padding: '20px 18px',
    marginBottom: '20px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.15)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#F8FAFC',
    boxSizing: 'border-box',
    animation: 'ftSlideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
  });

  card.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981;"></span>
        <span style="font-size: 13px; font-weight: 700; color: #6EE7B7; letter-spacing: 0.3px;">ZEN FOCUS SHIELD</span>
      </div>
      <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 10px;">Active</span>
    </div>

    <div style="
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
    ">
      <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #94A3B8; margin-bottom: 2px;">Session Objective</div>
      <div id="ft-zen-goal-text" style="font-size: 13px; font-weight: 600; color: #F1F5F9; word-break: break-word;">🎯 ${escapeHtml(goal)}</div>
    </div>

    <p style="margin: 0 0 14px 0; font-size: 12px; line-height: 1.45; color: #94A3B8;">
      Sidebar recommendations and distracting comments are filtered to protect your focus.
    </p>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <button id="ft-zen-peek-btn" style="
        width: 100%;
        padding: 9px 14px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #F8FAFC;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
      ">
        👁️ <span id="ft-zen-peek-text">Peek Recommendations</span>
      </button>

      <button id="ft-zen-search-btn" style="
        width: 100%;
        padding: 9px 14px;
        border-radius: 10px;
        background: linear-gradient(135deg, rgba(255, 42, 85, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
        border: 1px solid rgba(255, 42, 85, 0.4);
        color: #FDA4AF;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
      ">
        🔍 <span>Search "${escapeHtml(goal)}"</span>
      </button>
    </div>
  `;

  if (secondaryContainer.firstChild) {
    secondaryContainer.insertBefore(card, secondaryContainer.firstChild);
  } else {
    secondaryContainer.appendChild(card);
  }
  zenPlaceholderEl = card;

  card.querySelector('#ft-zen-peek-btn')?.addEventListener('click', () => {
    isZenPeeking = !isZenPeeking;
    updateZenModeStyle(true, isZenPeeking, currentHideComments);
    const peekBtn = card.querySelector('#ft-zen-peek-btn');
    const peekText = card.querySelector('#ft-zen-peek-text');
    if (isZenPeeking) {
      if (peekText) peekText.textContent = 'Hide Recommendations';
      if (peekBtn) {
        peekBtn.style.background = 'rgba(245, 158, 11, 0.2)';
        peekBtn.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        peekBtn.style.color = '#FDE68A';
      }
    } else {
      if (peekText) peekText.textContent = 'Peek Recommendations';
      if (peekBtn) {
        peekBtn.style.background = 'rgba(255, 255, 255, 0.08)';
        peekBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        peekBtn.style.color = '#F8FAFC';
      }
    }
  });

  card.querySelector('#ft-zen-search-btn')?.addEventListener('click', () => {
    window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(goal)}`;
  });
}

// Apply Zen Mode (Sidebar Distraction Masking)
function applyZenMode(goal, hideComments) {
  isZenModeActive = true;
  currentZenGoal = goal;
  currentHideComments = hideComments;
  updateZenModeStyle(true, isZenPeeking, hideComments);
  renderZenPlaceholder(goal);
}

// Remove Zen Mode and restore YouTube sidebar & comments
function removeZenMode() {
  isZenModeActive = false;
  isZenPeeking = false;
  currentZenGoal = null;
  updateZenModeStyle(false);
  if (zenPlaceholderEl && zenPlaceholderEl.parentNode) {
    zenPlaceholderEl.parentNode.removeChild(zenPlaceholderEl);
  }
  zenPlaceholderEl = null;
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
    const response = await fetch('https://focustube-n73c.onrender.com/classify', {
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

// Centralized navigation and route handler
async function handleNavigationChange(force = false) {
  const isWatch = isYouTubeWatchPage();
  const isShorts = isShortsPage();

  let sessionGoal = null;
  let blockShorts = true;
  let zenMode = true;
  let hideComments = true;

  try {
    const data = await chrome.storage.local.get(['sessionGoal', 'blockShorts', 'zenMode', 'hideComments']);
    sessionGoal = data.sessionGoal || null;
    blockShorts = data.blockShorts !== false;
    zenMode = data.zenMode !== false;
    hideComments = data.hideComments !== false;
  } catch (e) {}

  currentZenGoal = sessionGoal;
  currentHideComments = hideComments;

  // Update preemptive shelf clean-up
  const shouldHideShorts = Boolean(sessionGoal) && blockShorts;
  updateShortsHiderStyle(shouldHideShorts);

  if (isShorts) {
    removeExistingBanner();
    removeZenMode();
    if (sessionGoal && blockShorts) {
      if (Date.now() < shortsBreakEndTime) {
        return; // Break is still active
      }
      injectShortsShield(sessionGoal);
    } else {
      removeShortsShield();
    }
    return;
  }

  // Not on Shorts page
  removeShortsShield();
  removeShortsBreakBanner();

  if (isWatch) {
    if (sessionGoal && zenMode) {
      applyZenMode(sessionGoal, hideComments);
    } else {
      removeZenMode();
    }
    scheduleClassification(force);
  } else {
    removeExistingBanner();
    removeZenMode();
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
      handleNavigationChange(true);
    });
    titleMutationObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
}

// Observe YouTube SPA navigation events
window.addEventListener('yt-navigate-finish', () => handleNavigationChange(true));
window.addEventListener('popstate', () => handleNavigationChange(true));

// Real-time synchronization when sessionGoal, blockShorts, zenMode, or hideComments change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.sessionGoal || changes.blockShorts || changes.zenMode || changes.hideComments) {
      handleNavigationChange(true);
    }
  }
});

// Periodic lightweight path change observer (detects silent SPA transitions)
setInterval(() => {
  if (window.location.pathname !== lastObservedPath) {
    lastObservedPath = window.location.pathname;
    handleNavigationChange(false);
  }
}, 500);

// Initial execution on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupMutationObserver();
  handleNavigationChange(true);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setupMutationObserver();
    handleNavigationChange(true);
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
    handleNavigationChange(true);
    sendResponse({ status: 'scheduled' });
  }
  return true;
});
