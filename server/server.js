require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Chrome Extension requests
app.use(cors());
app.use(express.json());

// Initialize Groq SDK
const apiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: apiKey || 'dummy-key' });

// Fast & active Groq models in prioritized order
const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
];

// In-memory classification cache
const classificationCache = new Map();
const MAX_CACHE_SIZE = 500;

function pruneCacheIfNeeded() {
  if (classificationCache.size > MAX_CACHE_SIZE) {
    const firstKey = classificationCache.keys().next().value;
    classificationCache.delete(firstKey);
  }
}

// Fallback keyword comparison logic
function keywordClassify(goal, videoTitle) {
  const goalWords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const titleLower = videoTitle.toLowerCase();
  const isMatch = goalWords.some(word => titleLower.includes(word));
  
  return {
    status: isMatch ? 'on-topic' : 'off-topic',
    reason: isMatch 
      ? 'Video title matches session goal keywords' 
      : 'Video title does not appear directly related to goal'
  };
}

// Classification Endpoint
app.post('/classify', async (req, res) => {
  try {
    const { goal, videoTitle } = req.body;

    if (!goal || !videoTitle) {
      return res.status(400).json({ 
        error: 'Missing required parameters: goal and videoTitle are required.' 
      });
    }

    const cleanGoal = goal.trim();
    const cleanTitle = videoTitle.trim();
    const cacheKey = `${cleanGoal.toLowerCase()}_${cleanTitle.toLowerCase()}`;

    if (classificationCache.has(cacheKey)) {
      const cachedResult = classificationCache.get(cacheKey);
      return res.json({
        ...cachedResult,
        cached: true
      });
    }

    if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey === 'dummy-key') {
      const result = keywordClassify(cleanGoal, cleanTitle);
      classificationCache.set(cacheKey, result);
      pruneCacheIfNeeded();
      return res.json({ ...result, cached: false });
    }

    const systemPrompt = `You are an AI focus assistant for YouTube. Determine whether a video is relevant to the user's session goal.
Classify as "on-topic" if the video is relevant, educational, or helpful context for the user's goal. Otherwise, classify as "off-topic".
Respond strictly with a valid JSON object in this format:
{
  "status": "on-topic" | "off-topic",
  "reason": "one line explanation"
}`;

    const userPrompt = `User Goal: "${cleanGoal}"\nVideo Title: "${cleanTitle}"`;

    let chatCompletion = null;
    let usedModel = null;

    for (const modelCandidate of MODELS) {
      try {
        chatCompletion = await groq.chat.completions.create({
          model: modelCandidate,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        });
        usedModel = modelCandidate;
        break;
      } catch (err) {
        console.warn(`Model ${modelCandidate} failed (${err.message}). Trying next...`);
      }
    }

    if (chatCompletion) {
      const rawContent = chatCompletion.choices[0]?.message?.content;
      try {
        const parsed = JSON.parse(rawContent);
        const result = {
          status: parsed.status || 'on-topic',
          reason: parsed.reason || 'Classification complete',
          modelUsed: usedModel
        };
        classificationCache.set(cacheKey, result);
        pruneCacheIfNeeded();
        return res.json({ ...result, cached: false });
      } catch (pErr) {
        // Fallback on JSON parse failure
      }
    }

    // High-availability fallback if Groq models fail or encounter API issues
    const fallbackResult = keywordClassify(cleanGoal, cleanTitle);
    classificationCache.set(cacheKey, fallbackResult);
    pruneCacheIfNeeded();
    return res.json({ ...fallbackResult, cached: false });

  } catch (error) {
    console.error('Error in /classify endpoint:', error.message);
    const fallbackResult = keywordClassify(req.body.goal || '', req.body.videoTitle || '');
    return res.json({ ...fallbackResult, cached: false });
  }
});

// Session Summarization Endpoint
app.post('/summarize', async (req, res) => {
  try {
    const { goal, durationMinutes = 0, videoLog = [] } = req.body;

    if (!goal) {
      return res.status(400).json({ error: 'Missing required parameter: goal.' });
    }

    const totalVideos = videoLog.length;
    const onTopicVideos = videoLog.filter(v => v.status === 'on-topic');
    const offTopicVideos = videoLog.filter(v => v.status === 'off-topic');

    const calculatedScore = totalVideos > 0 
      ? Math.round((onTopicVideos.length / totalVideos) * 100)
      : 100;

    const durationText = `${Math.max(1, Math.round(durationMinutes))} mins`;

    const generateLocalSummary = () => {
      const topDistraction = offTopicVideos.length > 0 ? 'General Entertainment' : 'None';
      return {
        totalTime: durationText,
        focusScore: calculatedScore,
        topDistractionCategory: topDistraction,
        observation: `You watched ${onTopicVideos.length} on-topic video(s) out of ${totalVideos} total. ${calculatedScore >= 80 ? 'Great job staying focused!' : 'Keep pushing for higher focus next session.'}`
      };
    };

    if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey === 'dummy-key') {
      return res.json(generateLocalSummary());
    }

    const systemPrompt = `You are an encouraging AI focus coach for YouTube. Given a user's session goal, duration, and list of watched videos with their statuses, generate a structured session summary.
Respond strictly with a valid JSON object in this exact format:
{
  "totalTime": "${durationText}",
  "focusScore": ${calculatedScore},
  "topDistractionCategory": "e.g. Gaming, Music, Tech News, or None",
  "observation": "1-2 sentence constructive and motivational observation about their study session performance."
}`;

    const userPrompt = `User Goal: "${goal}"
Session Duration: ${durationText}
Total Videos Evaluated: ${totalVideos}
On-Topic Videos (${onTopicVideos.length}): ${JSON.stringify(onTopicVideos.map(v => v.title || v.videoTitle || v.videoKey))}
Off-Topic Videos (${offTopicVideos.length}): ${JSON.stringify(offTopicVideos.map(v => v.title || v.videoTitle || v.videoKey))}`;

    let chatCompletion = null;
    let usedModel = null;

    for (const modelCandidate of MODELS) {
      try {
        chatCompletion = await groq.chat.completions.create({
          model: modelCandidate,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        });
        usedModel = modelCandidate;
        break;
      } catch (err) {
        console.warn(`Summarize model ${modelCandidate} failed (${err.message}). Trying next...`);
      }
    }

    if (chatCompletion) {
      const rawContent = chatCompletion.choices[0]?.message?.content;
      try {
        const parsedSummary = JSON.parse(rawContent);
        return res.json({
          totalTime: parsedSummary.totalTime || durationText,
          focusScore: typeof parsedSummary.focusScore === 'number' ? parsedSummary.focusScore : calculatedScore,
          topDistractionCategory: parsedSummary.topDistractionCategory || (offTopicVideos.length > 0 ? 'Entertainment' : 'None'),
          observation: parsedSummary.observation || `Good effort studying! Focus score reached ${calculatedScore}%.`,
          modelUsed: usedModel
        });
      } catch (pErr) {
        // Fallback on JSON parse failure
      }
    }

    return res.json(generateLocalSummary());

  } catch (error) {
    console.error('Error in /summarize endpoint:', error.message);
    const durationMinutes = req.body.durationMinutes || 0;
    const durationText = `${Math.max(1, Math.round(durationMinutes))} mins`;
    return res.json({
      totalTime: durationText,
      focusScore: 100,
      topDistractionCategory: 'None',
      observation: 'Session completed successfully.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    cacheEntries: classificationCache.size,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`FocusTube server running on http://localhost:${PORT}`);
  console.log('⚡ High-performance Groq AI classification & Session Summarizer ready!');
});
