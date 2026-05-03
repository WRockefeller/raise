const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getVideos } = require('../services/youtube');

const router = express.Router();

// GET /videos?niche=fitness&sort=trending&time=week
router.get('/', authMiddleware, async (req, res) => {
  const { niche, sort = 'views', time = 'week' } = req.query;

  const validSorts = ['views', 'trending', 'newest'];
  const validTimes = ['today', 'week', 'month'];

  if (sort && !validSorts.includes(sort)) {
    return res.status(400).json({ error: 'Invalid sort. Use: views, trending, newest' });
  }
  if (time && !validTimes.includes(time)) {
    return res.status(400).json({ error: 'Invalid time. Use: today, week, month' });
  }

  try {
    const videos = await getVideos({ niche, sort, time });
    res.json({ videos, count: videos.length });
  } catch (err) {
    console.error('Videos route error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch videos' });
  }
});

module.exports = router;
