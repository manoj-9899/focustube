// FocusTube Dashboard Controller - Full Interactive Build

document.addEventListener('DOMContentLoaded', async () => {
  const chartContainer = document.getElementById('chartContainer');
  const historyGrid = document.getElementById('historyGrid');

  // Stat elements
  const avgScoreVal = document.getElementById('avgScoreVal');
  const avgScoreBar = document.getElementById('avgScoreBar');
  const totalTimeVal = document.getElementById('totalTimeVal');
  const sessionsCountText = document.getElementById('sessionsCountText');
  const avgSessionTimePill = document.getElementById('avgSessionTimePill');
  const totalVideosVal = document.getElementById('totalVideosVal');
  const onTopicPill = document.getElementById('onTopicPill');
  const offTopicPill = document.getElementById('offTopicPill');
  const topDistractionCard = document.getElementById('topDistractionCard');
  const topDistractionPill = document.getElementById('topDistractionPill');
  const topDistractionSub = document.getElementById('topDistractionSub');
  const currentHealthVal = document.getElementById('currentHealthVal');
  const currentHealthGrade = document.getElementById('currentHealthGrade');

  // Time Range & Filter Buttons
  const timeBtns = document.querySelectorAll('.time-btn');
  const filterBtns = document.querySelectorAll('.filter-pill');
  const filterAllBtn = document.getElementById('filterAllBtn');

  // Tooltip Elements
  const chartTooltipCard = document.getElementById('chartTooltipCard');
  const ttGoalTitle = document.getElementById('ttGoalTitle');
  const ttDate = document.getElementById('ttDate');
  const ttScore = document.getElementById('ttScore');
  const ttOnCount = document.getElementById('ttOnCount');
  const ttOffCount = document.getElementById('ttOffCount');
  const ttCloseBtn = document.getElementById('ttCloseBtn');

  // Global State
  let rawSessionHistory = [];
  let currentTimeRange = '7d'; // '7d', '30d', 'all'
  let currentFilter = 'all';     // 'all', 'high', 'low'

  // Format timestamp into clean date string
  function formatDate(timestamp) {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Filter history by time range ('7d', '30d', 'all')
  function getFilteredByTime(history) {
    if (!history || history.length === 0) return [];
    if (currentTimeRange === 'all') return history;

    const now = Date.now();
    const days = currentTimeRange === '30d' ? 30 : 7;
    const cutoff = now - (days * 24 * 60 * 60 * 1000);

    return history.filter(session => {
      if (!session.timestamp) return true;
      return session.timestamp >= cutoff;
    });
  }

  // Filter history by focus score filter ('all', 'high', 'low')
  function getFilteredByScore(history) {
    if (!history || history.length === 0) return [];
    if (currentFilter === 'high') {
      return history.filter(session => {
        const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
        return score > 70;
      });
    }
    if (currentFilter === 'low') {
      return history.filter(session => {
        const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
        return score < 50;
      });
    }
    return history;
  }

  // Calculate & Update Overview Stat Cards
  function updateStatCards(history) {
    if (!history || history.length === 0) {
      if (avgScoreVal) avgScoreVal.textContent = '0%';
      if (avgScoreBar) avgScoreBar.style.width = '0%';
      if (currentHealthVal) currentHealthVal.textContent = '0% Overall Focus';
      if (currentHealthGrade) currentHealthGrade.textContent = 'N/A';
      if (totalTimeVal) totalTimeVal.textContent = '0m';
      if (sessionsCountText) sessionsCountText.textContent = 'Across 0 sessions';
      if (avgSessionTimePill) avgSessionTimePill.textContent = '0m avg / session';
      if (totalVideosVal) totalVideosVal.textContent = '0';
      if (onTopicPill) onTopicPill.textContent = '0 On-Topic';
      if (offTopicPill) offTopicPill.textContent = '0 Intercepted';
      if (topDistractionCard) topDistractionCard.style.display = 'none';
      return;
    }

    let totalScoreSum = 0;
    let totalMinutes = 0;
    let totalOnCount = 0;
    let totalOffCount = 0;
    const distractionCounts = {};

    history.forEach(session => {
      const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
      totalScoreSum += score;

      const on = session.onTopicCount || 0;
      const off = session.offTopicCount || 0;
      totalOnCount += on;
      totalOffCount += off;

      if (session.topDistractionCategory && session.topDistractionCategory !== 'None') {
        const cat = session.topDistractionCategory;
        distractionCounts[cat] = (distractionCounts[cat] || 0) + 1;
      }

      if (typeof session.totalTime === 'string') {
        const num = parseInt(session.totalTime, 10);
        if (!isNaN(num)) totalMinutes += num;
      } else if (typeof session.totalTime === 'number') {
        totalMinutes += session.totalTime;
      }
    });

    const sessionCount = history.length;
    const avgScore = Math.round(totalScoreSum / sessionCount);

    if (avgScoreVal) avgScoreVal.textContent = `${avgScore}%`;
    if (avgScoreBar) avgScoreBar.style.width = `${avgScore}%`;

    if (currentHealthVal) currentHealthVal.textContent = `${avgScore}% Overall Focus`;
    if (currentHealthGrade) {
      if (avgScore >= 90) currentHealthGrade.textContent = 'A+';
      else if (avgScore >= 80) currentHealthGrade.textContent = 'A-';
      else if (avgScore >= 70) currentHealthGrade.textContent = 'B+';
      else if (avgScore >= 50) currentHealthGrade.textContent = 'C';
      else currentHealthGrade.textContent = 'D';
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const avgMinsPerSession = Math.round(totalMinutes / sessionCount) || 10;

    if (totalTimeVal) totalTimeVal.textContent = timeStr;
    if (sessionsCountText) sessionsCountText.textContent = `Across ${sessionCount} sessions`;
    if (avgSessionTimePill) avgSessionTimePill.textContent = `${avgMinsPerSession}m avg / session`;

    const totalVideos = totalOnCount + totalOffCount;
    if (totalVideosVal) totalVideosVal.textContent = totalVideos;
    if (onTopicPill) onTopicPill.textContent = `${totalOnCount} On-Topic`;
    if (offTopicPill) offTopicPill.textContent = `${totalOffCount} Intercepted`;

    let maxDistraction = null;
    let maxDistCount = 0;
    for (const [cat, count] of Object.entries(distractionCounts)) {
      if (count > maxDistCount) {
        maxDistCount = count;
        maxDistraction = cat;
      }
    }

    if (!maxDistraction || maxDistraction === 'None') {
      if (topDistractionCard) topDistractionCard.style.display = 'none';
    } else {
      if (topDistractionCard) topDistractionCard.style.display = 'flex';
      if (topDistractionPill) topDistractionPill.textContent = maxDistraction;
      const pct = totalOffCount > 0 ? Math.round((maxDistCount / sessionCount) * 100) : 0;
      if (topDistractionSub) topDistractionSub.textContent = `Caused ${pct}% of distracted detours`;
    }
  }

  // Render Stacked Bar Chart for sessions in time range
  function renderChart(history) {
    if (!history || history.length === 0) {
      chartContainer.innerHTML = '<div class="empty-history">No sessions recorded in this time range.</div>';
      return;
    }

    const last7Sessions = history.slice(-7);

    chartContainer.innerHTML = last7Sessions.map((session, index) => {
      const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
      const onCount = session.onTopicCount || (score >= 50 ? 5 : 2);
      const offCount = session.offTopicCount || (score < 50 ? 4 : 1);
      const total = onCount + offCount;

      const onPct = total > 0 ? Math.round((onCount / total) * 100) : score;
      const offPct = 100 - onPct;

      const sessionNum = `S${index + 1}`;
      const goalStr = session.goal || 'Session Goal';
      const dateStr = formatDate(session.timestamp);

      const safeGoal = goalStr.replace(/"/g, '&quot;');

      return `
        <div class="chart-bar-group" 
             data-goal="${safeGoal}" 
             data-date="${dateStr}" 
             data-score="${score}" 
             data-on="${onCount}" 
             data-off="${offCount}"
             title="Click to view details for ${sessionNum}">
          <div class="bar-top-percent">${score}%</div>
          <div class="stacked-bar-track">
            <div class="bar-segment-off" style="height: ${offPct}%;"></div>
            <div class="bar-segment-on" style="height: ${onPct}%;"></div>
          </div>
          <div class="bar-bottom-labels">
            <span class="bar-session-id">${sessionNum}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click event listeners to bar groups for tooltip popup
    document.querySelectorAll('.chart-bar-group').forEach(barGroup => {
      barGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const goal = barGroup.getAttribute('data-goal');
        const date = barGroup.getAttribute('data-date');
        const score = barGroup.getAttribute('data-score');
        const on = barGroup.getAttribute('data-on');
        const off = barGroup.getAttribute('data-off');

        ttGoalTitle.textContent = goal;
        ttDate.textContent = date;
        ttScore.textContent = `${score}%`;
        ttOnCount.textContent = on;
        ttOffCount.textContent = off;

        // Position tooltip card relative to chart wrapper
        const barRect = barGroup.getBoundingClientRect();
        const wrapperRect = document.querySelector('.chart-wrapper').getBoundingClientRect();
        
        let leftPos = barRect.left - wrapperRect.left - 80;
        leftPos = Math.max(10, Math.min(leftPos, wrapperRect.width - 230));

        chartTooltipCard.style.left = `${leftPos}px`;
        chartTooltipCard.style.bottom = `65px`;
        chartTooltipCard.style.display = 'flex';
      });
    });
  }

  // Render past session cards in reverse chronological order
  function renderHistoryList(history) {
    if (!history || history.length === 0) {
      historyGrid.innerHTML = `
        <div class="empty-history">
          No session history found matching current filters.
        </div>
      `;
      return;
    }

    const reverseHistory = history.slice().reverse();

    historyGrid.innerHTML = reverseHistory.map(session => {
      const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
      let badgeClass = 'high';
      let statusTagText = 'Target Met';
      let statusTagClass = 'target-met';

      if (score < 50) {
        badgeClass = 'low';
        statusTagText = 'Needs Review';
        statusTagClass = 'needs-review';
      } else if (score < 80) {
        badgeClass = 'mid';
        statusTagText = 'Disciplined';
        statusTagClass = 'disciplined';
      }

      const dateStr = formatDate(session.timestamp);
      const goalStr = session.goal || 'youtube focus session';
      const durationStr = session.totalTime || '10 mins';
      const onCount = session.onTopicCount || 0;
      const offCount = session.offTopicCount || 0;
      const topDistraction = session.topDistractionCategory;
      const observation = session.observation || 'Good study session.';

      const showDistraction = topDistraction && topDistraction !== 'None';

      return `
        <div class="session-summary-card">
          <div class="session-card-header">
            <div class="session-goal-box">
              <div class="session-goal-title-row">
                <span class="session-goal-mono">${goalStr}</span>
                <span class="status-tag ${statusTagClass}">${statusTagText}</span>
              </div>
              <div class="session-date-meta">
                <span>📅 ${dateStr}</span>
                <span>•</span>
                <span>⏱️ ${durationStr}</span>
              </div>
            </div>
            <div class="score-badge-pill ${badgeClass}">${score}% FOCUS</div>
          </div>

          <div class="session-metrics-row">
            <span class="metric-pill green-dot">
              <span class="metric-dot"></span>
              On-Topic: <strong>${onCount} videos</strong>
            </span>
            <span class="metric-pill red-dot">
              <span class="metric-dot"></span>
              Off-Topic: <strong class="red-text">${offCount} videos</strong>
            </span>
            ${showDistraction ? `
              <span class="metric-pill">
                Top Distraction: <strong class="yellow-text">${topDistraction}</strong>
              </span>
            ` : ''}
          </div>

          <div class="groq-insight-box">
            <span class="insight-bulb">💡</span>
            <div class="insight-text">
              <strong>Groq AI Insight:</strong> ${observation}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Update full UI based on time range and filter states
  function updateDashboardView() {
    const timeFilteredHistory = getFilteredByTime(rawSessionHistory);

    // Update filter All Sessions button label count
    if (filterAllBtn) {
      filterAllBtn.textContent = `All Sessions (${timeFilteredHistory.length})`;
    }

    updateStatCards(timeFilteredHistory);
    renderChart(timeFilteredHistory);

    const fullyFilteredHistory = getFilteredByScore(timeFilteredHistory);
    renderHistoryList(fullyFilteredHistory);
  }

  // Event Listeners for Time Range Buttons ('7 Days', '30 Days', 'All Time')
  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('30')) currentTimeRange = '30d';
      else if (text.includes('all')) currentTimeRange = 'all';
      else currentTimeRange = '7d';

      if (chartTooltipCard) chartTooltipCard.style.display = 'none';
      updateDashboardView();
    });
  });

  // Event Listeners for Filter Pills ('All Sessions', 'High Focus', 'Distracted')
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterAttr = btn.getAttribute('data-filter');
      if (filterAttr) {
        currentFilter = filterAttr;
      } else {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('high')) currentFilter = 'high';
        else if (text.includes('distracted')) currentFilter = 'low';
        else currentFilter = 'all';
      }

      updateDashboardView();
    });
  });

  // Tooltip close button
  if (ttCloseBtn) {
    ttCloseBtn.addEventListener('click', () => {
      chartTooltipCard.style.display = 'none';
    });
  }

  // Dismiss tooltip on click outside
  document.addEventListener('click', (e) => {
    if (chartTooltipCard && chartTooltipCard.style.display !== 'none') {
      if (!chartTooltipCard.contains(e.target) && !e.target.closest('.chart-bar-group')) {
        chartTooltipCard.style.display = 'none';
      }
    }
  });

  // Load session history from chrome.storage.local
  async function loadDashboardData() {
    try {
      const data = await chrome.storage.local.get(['sessionHistory']);
      rawSessionHistory = data.sessionHistory || [];
      updateDashboardView();
    } catch (err) {
      chartContainer.innerHTML = '<div class="empty-history">Failed to load history data.</div>';
      historyGrid.innerHTML = '<div class="empty-history">Failed to load session history.</div>';
    }
  }

  // Initial load
  await loadDashboardData();
});
