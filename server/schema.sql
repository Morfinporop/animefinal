CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  avatar_color VARCHAR(16) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anime (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  year INT NOT NULL DEFAULT 2024,
  age_rating VARCHAR(8) NOT NULL DEFAULT '12+',
  genres TEXT[] NOT NULL DEFAULT '{}',
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  video_data BYTEA,
  video_mime VARCHAR(50),
  views_count INT NOT NULL DEFAULT 0,
  likes_count INT NOT NULL DEFAULT 0,
  dislikes_count INT NOT NULL DEFAULT 0,
  author_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_votes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1 OR vote = -1),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_created ON anime(created_at DESC);
