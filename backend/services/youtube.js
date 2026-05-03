const NodeCache = require('node-cache');
const pool = require('../db');

const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 600 });

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Maps niche keywords to YouTube category IDs
const NICHE_CATEGORY_MAP = {
  fitness:       '17', // Sports
  sports:        '17',
  gaming:        '20', // Gaming
  music:         '10', // Music
  tech:          '28', // Science & Technology
  technology:    '28',
  science:       '28',
  news:          '25', // News & Politics
  politics:      '25',
  education:     '27', // Education
  cooking:       '26', // Howto & Style
  food:          '26',
  fashion:       '26',
  beauty:        '26',
  travel:        '19', // Travel & Events
  cars:          '2',  // Autos & Vehicles
  automotive:    '2',
  comedy:        '23', // Comedy
  entertainment: '24', // Entertainment
  film:          '1',  // Film & Animation
  animation:     '1',
};

function getCategoryId(niche) {
  if (!niche) return null;
  const key = niche.toLowerCase().trim();
  for (const [k, v] of Object.entries(NICHE_CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

// Fetch trending/popular videos from YouTube
async function fetchYouTubeVideos({ niche, maxResults = 24, pageToken }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

  const categoryId = getCategoryId(niche);
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    maxResults,
    regionCode: 'US',
    key: apiKey,
  });

  if (categoryId) params.set('videoCategoryId', categoryId);
  if (pageToken) params.set('pageToken', pageToken);

  // If niche has no category mapping, use search instead
  let url;
  if (!categoryId && niche) {
    url = `${YOUTUBE_API_BASE}/search?${new URLSearchParams({
      part: 'snippet',
      q: niche,
      type: 'video',
      order: 'viewCount',
      maxResults,
      key: apiKey,
    })}`;
  } else {
    url = `${YOUTUBE_API_BASE}/videos?${params}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json();
    throw new Error(`YouTube API error: ${errBody.error?.message || res.statusText}`);
  }

  const data = await res.json();

  // If search result, fetch full video details
  if (!categoryId && niche) {
    const ids = data.items.map(i => i.id.videoId).join(',');
    const detailRes = await fetch(
      `${YOUTUBE_API_BASE}/videos?${new URLSearchParams({
        part: 'snippet,statistics',
        id: ids,
        key: apiKey,
      })}`
    );
    const detailData = await detailRes.json();
    return detailData;
  }

  return data;
}

// Save a video + snapshot to DB, return video with growth
async function upsertVideoWithSnapshot(item) {
  const videoId = item.id;
  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const views = parseInt(stats.viewCount || 0);
  const likes = parseInt(stats.likeCount || 0);

  // Upsert video record
  await pool.query(
    `INSERT INTO videos (id, title, channel, channel_id, thumbnail, category, published_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       updated_at = NOW()`,
    [
      videoId,
      snippet.title,
      snippet.channelTitle,
      snippet.channelId,
      snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
      snippet.categoryId,
      snippet.publishedAt,
    ]
  );

  // Insert snapshot
  await pool.query(
    'INSERT INTO snapshots (video_id, views, likes) VALUES ($1, $2, $3)',
    [videoId, views, likes]
  );

  // Get previous snapshot for growth calculation
  const snapshots = await pool.query(
    `SELECT views, timestamp FROM snapshots
     WHERE video_id = $1
     ORDER BY timestamp DESC
     LIMIT 2`,
    [videoId]
  );

  let growthRate = 0; // views per hour
  if (snapshots.rows.length === 2) {
    const [latest, previous] = snapshots.rows;
    const timeDiffHours =
      (new Date(latest.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60);
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
    views,
    likes,
    publishedAt: snippet.publishedAt,
    growthRate,
    growthLabel: formatGrowth(growthRate),
  };
}

function formatGrowth(viewsPerHour) {
  if (viewsPerHour <= 0) return null;
  if (viewsPerHour >= 1_000_000) return `+${(viewsPerHour / 1_000_000).toFixed(1)}M/hr`;
  if (viewsPerHour >= 1_000) return `+${Math.round(viewsPerHour / 1000)}k/hr`;
  return `+${viewsPerHour}/hr`;
}

// Main service function
async function getVideos({ niche, sort = 'views', time = 'week' }) {
  const cacheKey = `videos:${niche}:${sort}:${time}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Fetch from YouTube
  const data = await fetchYouTubeVideos({ niche });
  const items = data.items || [];

  // Process each video (upsert + snapshot)
  const videos = await Promise.all(items.map(upsertVideoWithSnapshot));

  // Apply time filter
  const now = Date.now();
  const timeMs = { today: 86400000, week: 604800000, month: 2592000000 }[time] || 604800000;
  const filtered = videos.filter(v => {
    if (!v.publishedAt) return true;
    return now - new Date(v.publishedAt).getTime() <= timeMs;
  });

  // Apply sort
  let sorted;
  if (sort === 'views') {
    sorted = filtered.sort((a, b) => b.views - a.views);
  } else if (sort === 'trending') {
    sorted = filtered.sort((a, b) => b.growthRate - a.growthRate);
  } else if (sort === 'newest') {
    sorted = filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } else {
    sorted = filtered;
  }

  cache.set(cacheKey, sorted);
  return sorted;
}

module.exports = { getVideos };
