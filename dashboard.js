// FocusTube Dashboard Controller - Redesigned UI

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

  // Calculate & Update Overview Stat Cards
  function updateStatCards(history) {
    if (!history || history.length === 0) return;

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

      // Parse minutes if string like "10 mins" or "15m"
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

    // Health score
    if (currentHealthVal) currentHealthVal.textContent = `${avgScore}% Overall Focus`;
    if (currentHealthGrade) {
      if (avgScore >= 90) currentHealthGrade.textContent = 'A+';
      else if (avgScore >= 80) currentHealthGrade.textContent = 'A-';
      else if (avgScore >= 70) currentHealthGrade.textContent = 'B+';
      else if (avgScore >= 50) currentHealthGrade.textContent = 'C';
      else currentHealthGrade.textContent = 'D';
    }

    // Study Time
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    const avgMinsPerSession = Math.round(totalMinutes / sessionCount) || 10;

    if (totalTimeVal) totalTimeVal.textContent = timeStr;
    if (sessionsCountText) sessionsCountText.textContent = `Across ${sessionCount} sessions`;
    if (avgSessionTimePill) avgSessionTimePill.textContent = `${avgMinsPerSession}m avg / session`;

    // Videos Filtered
    const totalVideos = totalOnCount + totalOffCount;
    if (totalVideosVal) totalVideosVal.textContent = totalVideos;
    if (onTopicPill) onTopicPill.textContent = `${totalOnCount} On-Topic`;
    if (offTopicPill) offTopicPill.textContent = `${totalOffCount} Intercepted`;

    // Top Distraction
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

  // Render Stacked Bar Chart for last 7 sessions
  function renderChart(history) {
    if (!history || history.length === 0) {
      chartContainer.innerHTML = '<div class="empty-history">No sessions recorded yet. Start a session in the extension popup!</div>';
      return;
    }

    // Take last 7 sessions
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

      return `
        <div class="chart-bar-group">
          <div class="bar-top-percent">${score}%</div>
          <div class="stacked-bar-track" title="Session ${index + 1}: ${goalStr} (${score}% focus)">
            <div class="bar-segment-off" style="height: ${offPct}%;"></div>
            <div class="bar-segment-on" style="height: ${onPct}%;"></div>
          </div>
          <div class="bar-bottom-labels">
            <span class="bar-session-id">${sessionNum}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render past session cards in reverse chronological order
  function renderHistoryList(history) {
    if (!history || history.length === 0) {
      historyGrid.innerHTML = `
        <div class="empty-history">
          No session history found. Click <strong>End Session</strong> in the FocusTube extension popup to generate your first AI session summary!
        </div>
      `;
      return;
    }

    // Reverse chronological order
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

  // Load session history from chrome.storage.local
  async function loadDashboardData() {
    try {
      const data = await chrome.storage.local.get(['sessionHistory']);
      const history = data.sessionHistory || [];

      updateStatCards(history);
      renderChart(history);
      renderHistoryList(history);
    } catch (err) {
      chartContainer.innerHTML = '<div class="empty-history">Failed to load history data.</div>';
      historyGrid.innerHTML = '<div class="empty-history">Failed to load session history.</div>';
    }
  }

  // Initial load
  await loadDashboardData();
});
