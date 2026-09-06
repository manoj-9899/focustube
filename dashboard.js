// FocusTube Dashboard Controller

document.addEventListener('DOMContentLoaded', async () => {
  const chartContainer = document.getElementById('chartContainer');
  const historyGrid = document.getElementById('historyGrid');

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

  // Load session history from chrome.storage.local
  async function loadDashboardData() {
    try {
      const data = await chrome.storage.local.get(['sessionHistory']);
      const history = data.sessionHistory || [];

      renderChart(history);
      renderHistoryList(history);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      chartContainer.innerHTML = '<div class="empty-history">Failed to load history data.</div>';
      historyGrid.innerHTML = '<div class="empty-history">Failed to load session history.</div>';
    }
  }

  // Render plain HTML/CSS trend bar chart for last 7 sessions
  function renderChart(history) {
    if (!history || history.length === 0) {
      chartContainer.innerHTML = '<div class="empty-history">No sessions recorded yet. Start a session in the extension popup!</div>';
      return;
    }

    // Take last 7 sessions
    const last7Sessions = history.slice(-7);

    chartContainer.innerHTML = last7Sessions.map((session, index) => {
      const score = typeof session.focusScore === 'number' ? session.focusScore : 100;
      let scoreClass = 'high';
      if (score < 50) scoreClass = 'low';
      else if (score < 80) scoreClass = 'mid';

      const shortLabel = `S${index + 1}`;

      return `
        <div class="chart-bar-group">
          <div class="bar-value">${score}%</div>
          <div class="bar-track" title="Session ${index + 1}: ${session.goal} (${score}%)">
            <div class="bar-fill ${scoreClass}" style="height: ${score}%;"></div>
          </div>
          <div class="bar-label">${shortLabel}</div>
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
      if (score < 50) badgeClass = 'low';
      else if (score < 80) badgeClass = 'mid';

      const dateStr = formatDate(session.timestamp);
      const goalStr = session.goal || 'YouTube Focus Session';
      const durationStr = session.totalTime || '10 mins';
      const onCount = session.onTopicCount || 0;
      const offCount = session.offTopicCount || 0;
      const topDistraction = session.topDistractionCategory || 'None';
      const observation = session.observation || 'Good study session.';

      return `
        <div class="session-card">
          <div class="session-card-header">
            <div class="session-goal-info">
              <div class="session-goal-title">${goalStr}</div>
              <div class="session-meta">
                <span>📅 ${dateStr}</span>
                <span>⏱️ ${durationStr}</span>
              </div>
            </div>
            <div class="score-badge ${badgeClass}">${score}% FOCUS</div>
          </div>

          <div class="session-stats-row">
            <div class="stat-item">
              <span class="stat-label">On-Topic:</span>
              <span class="stat-val" style="color: #10B981;">${onCount}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Off-Topic:</span>
              <span class="stat-val" style="color: #EF4444;">${offCount}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Top Distraction:</span>
              <span class="stat-val">${topDistraction}</span>
            </div>
          </div>

          <div class="observation-box">
            💡 <strong>Groq AI Insight:</strong> ${observation}
          </div>
        </div>
      `;
    }).join('');
  }

  // Initial load
  await loadDashboardData();
});
