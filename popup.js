// FocusTube Popup Controller - Production Build

document.addEventListener('DOMContentLoaded', async () => {
  const goalForm = document.getElementById('goalForm');
  const goalInput = document.getElementById('goalInput');
  const startBtn = document.getElementById('startBtn');
  const clearBtn = document.getElementById('clearBtn');
  const endSessionBtn = document.getElementById('endSessionBtn');
  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  const refreshVideoBtn = document.getElementById('refreshVideoBtn');
  const videoTitleEl = document.getElementById('videoTitle');
  const statusDotEl = document.getElementById('statusDot');
  const statusTextEl = document.getElementById('statusText');
  const activeSessionCard = document.getElementById('activeSessionCard');
  const activeGoalText = document.getElementById('activeGoalText');
  const sessionTimeText = document.getElementById('sessionTimeText');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // Classification UI elements
  const classificationBox = document.getElementById('classificationBox');
  const topicBadge = document.getElementById('topicBadge');
  const classificationReason = document.getElementById('classificationReason');

  // Analytics & History elements
  const focusScoreText = document.getElementById('focusScoreText');
  const focusProgressBar = document.getElementById('focusProgressBar');
  const onTopicCountEl = document.getElementById('onTopicCount');
  const offTopicCountEl = document.getElementById('offTopicCount');
  const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
  const historyList = document.getElementById('historyList');

  // Summary Card elements
  const summaryCard = document.getElementById('summaryCard');
  const closeSummaryBtn = document.getElementById('closeSummaryBtn');
  const sumFocusScore = document.getElementById('sumFocusScore');
  const sumDuration = document.getElementById('sumDuration');
  const sumTopDistraction = document.getElementById('sumTopDistraction');
  const sumObservation = document.getElementById('sumObservation');

  let currentVideoTitle = null;
  let currentVideoId = null;
  let currentGoal = null;
  let currentStartTime = null;
  let isHistoryOpen = false;

  // Helper to show notification toast
  function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Format relative time
  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Started just now';
    const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsedSec < 60) return 'Started just now';
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `Started ${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    return `Started ${elapsedHours}h ago`;
  }

  // View Weekly Dashboard
  viewHistoryBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });

  // Toggle Watched Videos History list
  toggleHistoryBtn.addEventListener('click', () => {
    isHistoryOpen = !isHistoryOpen;
    toggleHistoryBtn.classList.toggle('active', isHistoryOpen);
    historyList.style.display = isHistoryOpen ? 'flex' : 'none';
  });

  // Close summary card
  closeSummaryBtn.addEventListener('click', () => {
    summaryCard.style.display = 'none';
  });

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
      // Fail silently
    }
  }

  // Render Focus Analytics stats & Watched Videos History breakdown
  async function loadAndRenderStats() {
    try {
      const data = await chrome.storage.local.get(['sessionStats']);
      const stats = data.sessionStats || { onTopicCount: 0, offTopicCount: 0, history: [] };

      const onCount = stats.onTopicCount || 0;
      const offCount = stats.offTopicCount || 0;
      const total = onCount + offCount;

      onTopicCountEl.textContent = onCount;
      offTopicCountEl.textContent = offCount;

      let scorePercent = 100;
      if (total > 0) {
        scorePercent = Math.round((onCount / total) * 100);
      }

      focusScoreText.textContent = `${scorePercent}%`;
      focusProgressBar.style.width = `${scorePercent}%`;

      if (scorePercent < 50) {
        focusProgressBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
        focusScoreText.style.color = '#ef4444';
      } else if (scorePercent < 80) {
        focusProgressBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
        focusScoreText.style.color = '#f59e0b';
      } else {
        focusProgressBar.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
        focusScoreText.style.color = '#10b981';
      }

      const historyItems = stats.history || [];
      if (historyItems.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No videos recorded yet in this session.</div>';
      } else {
        historyList.innerHTML = historyItems.slice().reverse().map(item => {
          const isOn = item.status === 'on-topic';
          const badgeClass = isOn ? 'on-topic' : 'off-topic';
          const badgeText = isOn ? 'ON-TOPIC' : 'OFF-TOPIC';
          const titleText = item.videoTitle || item.videoKey || 'YouTube Video';
          return `
            <div class="history-item">
              <span class="history-title" title="${titleText}">${titleText}</span>
              <span class="history-badge ${badgeClass}">${badgeText}</span>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      // Fail silently
    }
  }

  // Listen for storage changes in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.sessionStats) {
      loadAndRenderStats();
    }
  });

  // Perform AI classification request to localhost backend
  async function fetchClassification(goal, videoTitle) {
    if (!goal || !videoTitle) {
      classificationBox.style.display = 'none';
      return;
    }

    classificationBox.style.display = 'flex';
    topicBadge.className = 'topic-badge loading';
    topicBadge.textContent = 'Classifying...';
    classificationReason.textContent = 'Evaluating relevance...';

    try {
      const response = await fetch('http://localhost:3000/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, videoTitle })
      });

      if (!response.ok) {
        topicBadge.className = 'topic-badge off-topic';
        topicBadge.textContent = 'Server Error';
        classificationReason.textContent = 'FocusTube server not running. Start with npm start';
        return;
      }

      const data = await response.json();
      const isOffTopic = data.status === 'off-topic';

      topicBadge.className = isOffTopic ? 'topic-badge off-topic' : 'topic-badge on-topic';
      topicBadge.textContent = isOffTopic ? 'Off-Topic' : 'On-Topic';
      classificationReason.textContent = data.reason || 'Classification complete';

      const videoKey = currentVideoId || currentVideoTitle;
      await recordVideoClassification(videoKey, currentVideoTitle, data.status);
      await loadAndRenderStats();
    } catch (err) {
      topicBadge.className = 'topic-badge loading';
      topicBadge.textContent = 'Server Offline';
      classificationReason.textContent = 'FocusTube server not running. Start with npm start';
    }
  }

  // Load existing session goal from chrome.storage.local
  async function loadStoredGoal() {
    try {
      const data = await chrome.storage.local.get(['sessionGoal', 'sessionStartTime']);
      
      if (data && data.sessionGoal) {
        currentGoal = data.sessionGoal;
        currentStartTime = data.sessionStartTime;
        goalInput.value = data.sessionGoal;
        activeGoalText.textContent = data.sessionGoal;
        sessionTimeText.textContent = formatRelativeTime(data.sessionStartTime);
        activeSessionCard.style.display = 'block';
        startBtn.querySelector('span').textContent = 'Update Goal';
        await loadAndRenderStats();
      } else {
        currentGoal = null;
        currentStartTime = null;
        activeSessionCard.style.display = 'none';
        startBtn.querySelector('span').textContent = 'Start Session';
        classificationBox.style.display = 'none';
      }
    } catch (err) {
      // Fail silently
    }
  }

  // Fetch current YouTube video title from active tab
  async function detectYouTubeTitle() {
    videoTitleEl.className = 'video-title empty';
    videoTitleEl.textContent = 'Checking active tab...';
    statusDotEl.className = 'status-dot';
    statusTextEl.textContent = 'Checking...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        statusTextEl.textContent = 'No active tab';
        videoTitleEl.textContent = 'Unable to detect tab';
        return;
      }

      const isYouTube = tab.url && (tab.url.includes('youtube.com') || tab.url.includes('youtu.be'));

      if (!isYouTube) {
        statusDotEl.className = 'status-dot idle';
        statusTextEl.textContent = 'Not YouTube';
        videoTitleEl.textContent = 'Open a YouTube video to detect title';
        classificationBox.style.display = 'none';
        return;
      }

      const isWatchPage = tab.url.includes('/watch') && !tab.url.includes('/shorts') && !tab.url.includes('/results');

      if (!isWatchPage) {
        statusDotEl.className = 'status-dot idle';
        statusTextEl.textContent = 'YouTube';
        videoTitleEl.textContent = 'Navigate to a YouTube video page';
        classificationBox.style.display = 'none';
        return;
      }

      if (tab.url.includes('v=')) {
        try {
          const urlObj = new URL(tab.url);
          currentVideoId = urlObj.searchParams.get('v');
        } catch (e) {}
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_VIDEO_TITLE' });
        
        if (response && response.title) {
          currentVideoTitle = response.title;
          statusDotEl.className = 'status-dot active';
          statusTextEl.textContent = 'Active Video';
          videoTitleEl.className = 'video-title';
          videoTitleEl.textContent = response.title;
        } else if (tab.title) {
          const cleanTabTitle = tab.title.replace(/ - YouTube$/, '').trim();
          currentVideoTitle = cleanTabTitle !== 'YouTube' ? cleanTabTitle : null;
          statusDotEl.className = 'status-dot active';
          statusTextEl.textContent = 'Active Video';
          videoTitleEl.className = 'video-title';
          videoTitleEl.textContent = cleanTabTitle !== 'YouTube' ? cleanTabTitle : 'YouTube Video';
        }

        if (currentGoal && currentVideoTitle) {
          fetchClassification(currentGoal, currentVideoTitle);
          chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CLASSIFY' }).catch(() => {});
        }
      } catch (msgErr) {
        if (tab.title) {
          const cleanTabTitle = tab.title.replace(/ - YouTube$/, '').trim();
          currentVideoTitle = cleanTabTitle !== 'YouTube' ? cleanTabTitle : null;
          statusDotEl.className = 'status-dot active';
          statusTextEl.textContent = 'Active Video';
          videoTitleEl.className = 'video-title';
          videoTitleEl.textContent = cleanTabTitle !== 'YouTube' ? cleanTabTitle : 'YouTube Video';

          if (currentGoal && currentVideoTitle) {
            fetchClassification(currentGoal, currentVideoTitle);
          }
        }
      }
    } catch (err) {
      statusDotEl.className = 'status-dot';
      statusTextEl.textContent = 'Error';
      videoTitleEl.textContent = 'Error reading tab info';
    }
  }

  // Handle goal form submit (Start/Update Goal)
  goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalText = goalInput.value.trim();
    if (!goalText) return;

    const startTime = Date.now();
    try {
      await chrome.storage.local.set({
        sessionGoal: goalText,
        sessionStartTime: startTime,
        sessionStats: { onTopicCount: 0, offTopicCount: 0, history: [] }
      });

      currentGoal = goalText;
      currentStartTime = startTime;
      activeGoalText.textContent = goalText;
      sessionTimeText.textContent = 'Started just now';
      activeSessionCard.style.display = 'block';
      summaryCard.style.display = 'none';
      startBtn.querySelector('span').textContent = 'Update Goal';
      showToast('Session goal set!');

      await loadAndRenderStats();

      if (currentGoal && currentVideoTitle) {
        fetchClassification(currentGoal, currentVideoTitle);
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CLASSIFY' }).catch(() => {});
      }
    } catch (err) {
      showToast('Failed to save goal');
    }
  });

  // Handle End Session button click
  endSessionBtn.addEventListener('click', async () => {
    if (!currentGoal) return;

    endSessionBtn.textContent = 'Summarizing...';
    endSessionBtn.disabled = true;

    try {
      const storageData = await chrome.storage.local.get(['sessionStats', 'sessionStartTime', 'sessionHistory']);
      const stats = storageData.sessionStats || { onTopicCount: 0, offTopicCount: 0, history: [] };
      const startTime = storageData.sessionStartTime || currentStartTime || Date.now();
      const existingHistory = storageData.sessionHistory || [];

      const durationMinutes = Math.max(1, (Date.now() - startTime) / 60000);
      const videoLog = (stats.history || []).map(item => ({
        title: item.videoTitle || item.videoKey,
        status: item.status
      }));

      let summaryResult = null;
      try {
        const response = await fetch('http://localhost:3000/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: currentGoal,
            durationMinutes,
            videoLog
          })
        });

        if (response.ok) {
          summaryResult = await response.json();
        }
      } catch (srvErr) {
        // Fallback handled below
      }

      const onCount = stats.onTopicCount || 0;
      const offCount = stats.offTopicCount || 0;
      const total = onCount + offCount;
      const calcScore = total > 0 ? Math.round((onCount / total) * 100) : 100;
      const durText = `${Math.round(durationMinutes)}m`;

      const finalSummary = {
        timestamp: Date.now(),
        goal: currentGoal,
        totalTime: summaryResult?.totalTime || durText,
        focusScore: typeof summaryResult?.focusScore === 'number' ? summaryResult.focusScore : calcScore,
        onTopicCount: onCount,
        offTopicCount: offCount,
        topDistractionCategory: summaryResult?.topDistractionCategory || (offCount > 0 ? 'General Distractions' : 'None'),
        observation: summaryResult?.observation || `Session completed with ${calcScore}% focus rate.`
      };

      existingHistory.push(finalSummary);
      await chrome.storage.local.set({ sessionHistory: existingHistory });

      await chrome.storage.local.remove(['sessionGoal', 'sessionStartTime', 'sessionStats']);
      currentGoal = null;
      currentStartTime = null;
      goalInput.value = '';
      activeSessionCard.style.display = 'none';
      classificationBox.style.display = 'none';
      startBtn.querySelector('span').textContent = 'Start Session';

      sumFocusScore.textContent = `${finalSummary.focusScore}%`;
      sumDuration.textContent = finalSummary.totalTime;
      sumTopDistraction.textContent = finalSummary.topDistractionCategory;
      sumObservation.textContent = finalSummary.observation;
      summaryCard.style.display = 'block';

      showToast('Session summarized & saved!');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CLASSIFY' }).catch(() => {});
      }
    } catch (err) {
      showToast('Error ending session');
    } finally {
      endSessionBtn.textContent = 'End Session';
      endSessionBtn.disabled = false;
    }
  });

  // Handle Clear Session button click
  clearBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove(['sessionGoal', 'sessionStartTime', 'sessionStats']);
      currentGoal = null;
      currentStartTime = null;
      goalInput.value = '';
      activeSessionCard.style.display = 'none';
      classificationBox.style.display = 'none';
      summaryCard.style.display = 'none';
      startBtn.querySelector('span').textContent = 'Start Session';
      showToast('Goal cleared');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_CLASSIFY' }).catch(() => {});
      }
    } catch (err) {
      // Fail silently
    }
  });

  // Handle Refresh button click
  refreshVideoBtn.addEventListener('click', () => {
    detectYouTubeTitle();
  });

  // Initial setup execution
  await loadStoredGoal();
  await detectYouTubeTitle();
});
