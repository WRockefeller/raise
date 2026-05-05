const fetch = require("node-fetch");
const NodeCache = require('node-cache');
const pool = require('../db');

const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 600 });
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Multiple search terms per niche to get more videos
const NICHE_QUERIES = {
  fitness:        ['fitness workout','gym training','weight loss exercise','bodybuilding','home workout','cardio workout','strength training','fitness motivation'],
  gaming:         ['gaming highlights','best games 2025','gaming news','game review','esports','gaming tips','new game release','gaming moments'],
  tech:           ['tech review 2025','new technology','gadgets 2025','ai technology','tech news','smartphone review','laptop review','tech explained'],
  music:          ['new music 2025','music video','song cover','music production','new album','music mix','singer performance','music reaction'],
  cooking:        ['easy recipes','cooking tutorial','food recipe','meal prep','baking','cooking tips','dinner ideas','healthy food'],
  travel:         ['travel vlog','travel tips','best destinations','travel guide','solo travel','budget travel','travel 2025','explore world'],
  cars:           ['car review','supercar','new car 2025','car modification','car race','electric car','car test drive','automotive news'],
  fashion:        ['fashion haul','outfit ideas','style tips','fashion trends','clothing review','fashion lookbook','ootd','fashion week'],
  beauty:         ['makeup tutorial','skincare routine','beauty tips','hair tutorial','nail art','beauty products','glow up','beauty hacks'],
  finance:        ['investing tips','stock market','passive income','financial advice','crypto update','money tips','wealth building','financial freedom'],
  business:       ['business tips','entrepreneur advice','startup story','business strategy','how to make money','side hustle','business growth','success story'],
  science:        ['science explained','science experiment','space news','physics explained','biology facts','chemistry','scientific discovery','nature documentary'],
  education:      ['learn fast','study tips','history facts','math explained','educational video','knowledge facts','how things work','learning hacks'],
  comedy:         ['funny moments','comedy sketch','stand up comedy','funny fails','prank videos','comedy show','funny reactions','humor'],
  sports:         ['sports highlights','sports news','match highlights','athlete training','sports moments','best goals','sports analysis','game recap'],
  anime:          ['anime review','best anime 2025','anime moments','anime explained','manga review','anime reaction','new anime','anime top list'],
  crypto:         ['crypto news','bitcoin update','cryptocurrency','crypto investing','blockchain explained','altcoins','crypto trading','defi'],
  ai:             ['ai news','artificial intelligence','chatgpt','ai tools','machine learning','ai explained','future of ai','ai update 2025'],
  health:         ['health tips','mental health','nutrition advice','wellness routine','healthy lifestyle','diet tips','medical facts','mindfulness'],
  diy:            ['diy project','home improvement','diy crafts','woodworking','diy decoration','how to fix','home renovation','creative projects'],
};

// Fallback queries for unknown niches
function getQueries(niche) {
  if (!niche) return ['trending videos 2025'];
  const key = niche.toLowerCase().trim();
  if (NICHE_QUERIES[key]) return NICHE_QUERIES[key];
  // Try partial match
  for (const [k, v] of Object.entries(NICHE_QUERIES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Custom niche - generate queries
  return [
    `${niche} 2025`,
    `best ${niche}`,
    `${niche} tips`,
    `${niche} tutorial`,
    `${niche} news`,
    `${niche} review`,
  ];
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

  // Run first 4 queries in parallel to get ~200 video IDs fast
  const batchSize = 4;
  for (let i = 0; i < Math.min(queries.length, batchSize); i++) {
    try {
      const ids = await searchVideos(queries[i], apiKey);
      ids.forEach(id => {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allIds.push(id);
        }
      });
    } catch (err) {
      console.error(`Query failed: ${queries[i]}`, err.message);
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
