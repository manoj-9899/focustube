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
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768'
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
      console.warn('Warning: GROQ_API_KEY is not configured in .env. Using fallback keyword comparison.');
      
      const goalWords = cleanGoal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const titleLower = cleanTitle.toLowerCase();
      const isMatch = goalWords.some(word => titleLower.includes(word));
      
      const result = {
        status: isMatch ? 'on-topic' : 'off-topic',
        reason: isMatch 
          ? 'Video title matches goal keywords' 
          : 'Video title does not appear related to goal'
      };

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
    let lastError = null;

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
        lastError = err;
      }
    }

    if (!chatCompletion) {
      throw lastError || new Error('All Groq model attempts failed.');
    }

    const rawContent = chatCompletion.choices[0]?.message?.content;
    let parsedResult;

    try {
      parsedResult = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('JSON Parse error from Groq response:', rawContent);
      parsedResult = {
        status: 'on-topic',
        reason: 'Classification completed'
      };
    }

    const result = {
      status: parsedResult.status || 'on-topic',
      reason: parsedResult.reason || 'Classification completed',
      modelUsed: usedModel
    };

    classificationCache.set(cacheKey, result);
    pruneCacheIfNeeded();

    return res.json({ ...result, cached: false });

  } catch (error) {
    console.error('Error in /classify endpoint:', error.message);
    return res.status(500).json({
      error: 'Failed to classify video',
      details: error.message
    });
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

    if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey === 'dummy-key') {
      const topDistraction = offTopicVideos.length > 0 ? 'General Entertainment' : 'None';
      return res.json({
        totalTime: durationText,
        focusScore: calculatedScore,
        topDistractionCategory: topDistraction,
        observation: `You watched ${onTopicVideos.length} on-topic video(s) out of ${totalVideos} total. ${calculatedScore >= 80 ? 'Great job staying focused!' : 'Keep pushing for higher focus next session.'}`
      });
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
    let lastError = null;

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
        lastError = err;
      }
    }

    if (!chatCompletion) {
      throw lastError || new Error('All Groq model attempts failed for summary.');
    }

    const rawContent = chatCompletion.choices[0]?.message?.content;
    let parsedSummary;

    try {
      parsedSummary = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error('JSON Parse error from Groq summarize response:', rawContent);
      parsedSummary = {
        totalTime: durationText,
        focusScore: calculatedScore,
        topDistractionCategory: offTopicVideos.length > 0 ? 'Off-Topic Content' : 'None',
        observation: `Completed session with ${calculatedScore}% focus rate.`
      };
    }

    return res.json({
      totalTime: parsedSummary.totalTime || durationText,
      focusScore: typeof parsedSummary.focusScore === 'number' ? parsedSummary.focusScore : calculatedScore,
      topDistractionCategory: parsedSummary.topDistractionCategory || (offTopicVideos.length > 0 ? 'Entertainment' : 'None'),
      observation: parsedSummary.observation || `Good effort studying! Focus score reached ${calculatedScore}%.`,
      modelUsed: usedModel
    });

  } catch (error) {
    console.error('Error in /summarize endpoint:', error.message);
    return res.status(500).json({
      error: 'Failed to generate session summary',
      details: error.message
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
