const fetch = require("node-fetch");
const NodeCache = require('node-cache');
const pool = require('../db');

const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 600 });

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const NICHE_CATEGORY_MAP = {
  // Sports & Fitness
  fitness:          '17',
  sports:           '17',
  gym:              '17',
  workout:          '17',
  bodybuilding:     '17',
  yoga:             '17',
  running:          '17',
  cycling:          '17',
  football:         '17',
  basketball:       '17',
  soccer:           '17',
  tennis:           '17',
  golf:             '17',
  boxing:           '17',
  mma:              '17',
  wrestling:        '17',
  swimming:         '17',
  athletics:        '17',
  // Gaming
  gaming:           '20',
  games:            '20',
  esports:          '20',
  minecraft:        '20',
  fortnite:         '20',
  roblox:           '20',
  valorant:         '20',
  playstation:      '20',
  xbox:             '20',
  nintendo:         '20',
  // Music
  music:            '10',
  hiphop:           '10',
  rap:              '10',
  pop:              '10',
  rock:             '10',
  edm:              '10',
  jazz:             '10',
  classical:        '10',
  rnb:              '10',
  country:          '10',
  // Tech
  tech:             '28',
  technology:       '28',
  science:          '28',
  programming:      '28',
  coding:           '28',
  ai:               '28',
  crypto:           '28',
  bitcoin:          '28',
  blockchain:       '28',
  gadgets:          '28',
  apple:            '28',
  android:          '28',
  software:         '28',
  // News
  news:             '25',
  politics:         '25',
  worldnews:        '25',
  // Education
  education:        '27',
  learning:         '27',
  history:          '27',
  math:             '27',
  language:         '27',
  // Howto & Style
  cooking:          '26',
  food:             '26',
  fashion:          '26',
  beauty:           '26',
  makeup:           '26',
  skincare:         '26',
  hair:             '26',
  diy:              '26',
  crafts:           '26',
  homeimprovement:  '26',
  gardening:        '26',
  // Travel
  travel:           '19',
  vlog:             '19',
  adventure:        '19',
  hiking:           '19',
  // Autos
  cars:             '2',
  automotive:       '2',
  supercars:        '2',
  motorcycles:      '2',
  trucks:           '2',
  electric:         '2',
  tesla:            '2',
  // Comedy
  comedy:           '23',
  funny:            '23',
  memes:            '23',
  standup:          '23',
  // Entertainment
  entertainment:    '24',
  celebrity:        '24',
  movies:           '24',
  tvshows:          '24',
  anime:            '24',
  // Film
  film:             '1',
  animation:        '1',
  // Finance
  finance:          '27',
  investing:        '27',
  stocks:           '27',
  realestate:       '27',
  money:            '27',
  business:         '27',
  entrepreneurship: '27',
  // Pets
  pets:             '15',
  dogs:             '15',
  cats:             '15',
  animals:          '15',
  wildlife:         '15',
  // Kids
  kids:             '20',
  family:           '20',
};

function getCategoryId(niche) {
  if (!niche) return null;
  const key = niche.toLowerCase().trim().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(NICHE_CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

async function fetchYouTubeVideos({ niche, maxResults = 50, pageToken }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

  const categoryId = getCategoryId(niche);

  let url;
  if (!categoryId && niche) {
    url = `${YOUTUBE_API_BASE}/search?${new URLSearchParams({
      part: 'snippet',
      q: niche,
      type: 'video',
      order: 'viewCount',
      maxResults: 50,
      key: apiKey,
    })}`;
  } else {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      chart: 'mostPopular',
      maxResults: 50,
      regionCode: 'US',
      key: apiKey,
    });
    if (categoryId) params.set('videoCategoryId', categoryId);
    if (pageToken) params.set('pageToken', pageToken);
    url = `${YOUTUBE_API_BASE}/videos?${params}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json();
    throw new Error(`YouTube API error: ${errBody.error?.message || res.statusText}`);
  }

  return res.json();
}

async function upsertVideoWithSnapshot(item) {
  const videoId = item.id?.videoId || item.id;
  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const views = parseInt(stats.viewCount || 0);
  const likes = parseInt(stats.likeCount || 0);

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

  await pool.query(
    'INSERT INTO snapshots (video_id, views, likes) VALUES ($1, $2, $3)',
    [videoId, views, likes]
  );

  const snapshots = await pool.query(
    `SELECT views, timestamp FROM snapshots
     WHERE video_id = $1
     ORDER BY timestamp DESC
     LIMIT 2`,
    [videoId]
  );

  let growthRate = 0;
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

async function getVideos({ niche, sort = 'views', time = 'week' }) {
  const cacheKey = `videos:${niche}:${sort}:${time}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchYouTubeVideos({ niche });
  const items = data.items || [];

  const videos = await Promise.all(items.map(upsertVideoWithSnapshot));

  const now = Date.now();
  const timeMs = { today: 86400000, week: 604800000, month: 2592000000 }[time] || 604800000;
  const filtered = videos.filter(v => {
    if (!v.publishedAt) return true;
    return now - new Date(v.publishedAt).getTime() <= timeMs;
  });

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
