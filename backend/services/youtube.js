const fetch = require("node-fetch");
const NodeCache = require('node-cache');
const pool = require('../db');

const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 600 });
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const NICHE_QUERIES = {
  fitness:    ['fitness workout 2025', 'gym training motivation'],
  gym:           '17',
  gaming:     ['gaming highlights 2025', 'best games review'],
  tech:       ['tech review 2025', 'new technology gadgets'],
  music:      ['new music video 2025', 'music performance'],
  cooking:    ['easy recipes 2025', 'cooking tutorial'],
  travel:     ['travel vlog 2025', 'best travel destinations'],
  cars:       ['car review 2025', 'supercar test drive'],
  fashion:    ['fashion haul 2025', 'outfit ideas style'],
  beauty:     ['makeup tutorial 2025', 'skincare routine'],
  finance:    ['investing tips 2025', 'stock market explained'],
  business:   ['business tips 2025', 'entrepreneur success'],
  science:    ['science explained 2025', 'scientific discovery'],
  education:  ['educational video 2025', 'learning tips'],
  comedy:     ['funny moments 2025', 'comedy sketch'],
  sports:     ['sports highlights 2025', 'match highlights'],
  anime:      ['anime review 2025', 'best anime moments'],
  crypto:     ['crypto news 2025', 'bitcoin update'],
  ai:         ['artificial intelligence 2025', 'ai tools review'],
  health:     ['health tips 2025', 'wellness routine'],
  diy:        ['diy project 2025', 'home improvement ideas'],
};

function getQueries(niche) {
  if (!niche) return ['trending videos 2025'];
  const key = niche.toLowerCase().trim();
  if (NICHE_QUERIES[key]) return NICHE_QUERIES[key];
  for (const [k, v] of Object.entries(NICHE_QUERIES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [`${niche} 2025`, `best ${niche} videos`];
}

function parseDuration(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1]||0)*3600) + (parseInt(match[2]||0)*60) + parseInt(match[3]||0);
}

async function searchVideos(query, apiKey) {
  const url = `${YOUTUBE_API_BASE}/search?${new URLSearchParams({
    part: 'id',
    q: query,
    type: 'video',
    order: 'viewCount',
    maxResults: 50,
    key: apiKey,
  })}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube API error: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []).map(i => i.id.videoId).filter(Boolean);
}

async function fetchVideoDetails(ids, apiKey) {
  if (!ids.length) return [];
  const url = `${YOUTUBE_API_BASE}/videos?${new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: ids.join(','),
    key: apiKey,
  })}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube API error: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.items || [];
}

async function upsertVideoWithSnapshot(item) {
  const videoId = item.id?.videoId || item.id;
  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const content = item.contentDetails || {};
  const views = parseInt(stats.viewCount || 0);
  const likes = parseInt(stats.likeCount || 0);
  const durationSecs = parseDuration(content.duration);

  await pool.query(
    `INSERT INTO videos (id, title, channel, channel_id, thumbnail, category, published_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`,
    [
      videoId, snippet.title, snippet.channelTitle, snippet.channelId,
      snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      snippet.categoryId, snippet.publishedAt,
    ]
  );

  await pool.query(
    'INSERT INTO snapshots (video_id, views, likes) VALUES ($1, $2, $3)',
    [videoId, views, likes]
  );

  const snapshots = await pool.query(
    `SELECT views, timestamp FROM snapshots WHERE video_id = $1 ORDER BY timestamp DESC LIMIT 2`,
    [videoId]
  );

  let growthRate = 0;
  if (snapshots.rows.length === 2) {
    const [latest, previous] = snapshots.rows;
    const timeDiffHours = (new Date(latest.timestamp) - new Date(previous.timestamp)) / 3600000;
    if (timeDiffHours > 0) {
      growthRate = Math.round((latest.views - previous.views) / timeDiffHours);
    }
  }

  return {
    id: videoId,
    title: snippet.title,
    channel: snippet.channelTitle,
    channelId: snippet.channelId,
    thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
    views, likes, duration: durationSecs,
    publishedAt: snippet.publishedAt,
    growthRate,
    growthLabel: formatGrowth(growthRate),
  };
}

function formatGrowth(n) {
  if (n <= 0) return null;
  if (n >= 1_000_000) return `+${(n/1_000_000).toFixed(1)}M/hr`;
  if (n >= 1_000) return `+${Math.round(n/1000)}k/hr`;
  return `+${n}/hr`;
}

async function getVideos({ niche, sort = 'views', time = 'week' }) {
  const cacheKey = `videos:${niche}:${sort}:${time}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

  const queries = getQueries(niche);
  const seenIds = new Set();
  const allIds = [];

  // Run queries one at a time to avoid quota issues
  for (const query of queries) {
    try {
      const ids = await searchVideos(query, apiKey);
      ids.forEach(id => {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allIds.push(id);
        }
      });
    } catch (err) {
      console.error(`Query failed: ${query}`, err.message);
    }
  }

  // Fetch details in batches of 50
  const allItems = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    try {
      const items = await fetchVideoDetails(batch, apiKey);
      allItems.push(...items);
    } catch (err) {
      console.error('Details fetch failed:', err.message);
    }
  }

  if (!allItems.length) throw new Error('No videos found. Check YouTube API quota.');

  const videos = await Promise.all(allItems.map(upsertVideoWithSnapshot));

  const now = Date.now();
  const timeMs = { today: 86400000, week: 604800000, month: 2592000000 }[time] || 604800000;
  const filtered = videos.filter(v => {
    if (!v.publishedAt) return true;
    return now - new Date(v.publishedAt).getTime() <= timeMs;
  });

  let sorted;
  if (sort === 'views') sorted = filtered.sort((a, b) => b.views - a.views);
  else if (sort === 'trending') sorted = filtered.sort((a, b) => b.growthRate - a.growthRate);
  else if (sort === 'newest') sorted = filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  else sorted = filtered;

  cache.set(cacheKey, sorted);
  return sorted;
}

module.exports = { getVideos };
