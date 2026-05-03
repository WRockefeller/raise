require('dotenv').config();
const pool = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        niche       VARCHAR(100),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id          VARCHAR(20) PRIMARY KEY,  -- YouTube video ID
        title       TEXT NOT NULL,
        channel     VARCHAR(255),
        channel_id  VARCHAR(50),
        thumbnail   TEXT,
        category    VARCHAR(100),
        published_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id         SERIAL PRIMARY KEY,
        video_id   VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
        views      BIGINT NOT NULL,
        likes      BIGINT DEFAULT 0,
        timestamp  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_video_id ON snapshots(video_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp DESC);
    `);

    console.log('✓ Migrations complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
