-- TerraTales Database Schema

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bio           TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  color         VARCHAR(10) NOT NULL DEFAULT '#3b82f6',
  verified      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT DEFAULT '',
  start_date      BIGINT NOT NULL,
  end_date        BIGINT,
  visibility      VARCHAR(20) DEFAULT 'private',
  difficulty      VARCHAR(20),
  cover_photo_url TEXT,
  tags            TEXT[] DEFAULT '{}',
  likes           TEXT[] DEFAULT '{}',
  gpx_data        TEXT,
  gpx_stats       TEXT,
  packing_items   TEXT[] DEFAULT '{}',
  packing_list    TEXT[] DEFAULT '{}',
  day_comments    JSONB DEFAULT '{}',
  external_links  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  title      VARCHAR(200) NOT NULL,
  comment    TEXT DEFAULT '',
  photo_url  TEXT DEFAULT '',
  type       VARCHAR(50) DEFAULT 'adventure',
  timestamp  BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
