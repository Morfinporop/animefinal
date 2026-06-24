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
  poster_data TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INT NOT NULL DEFAULT 2024,
  video_url TEXT NOT NULL DEFAULT '',
  views_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  parent_id INT REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE TABLE IF NOT EXISTS views (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);
CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_created_at ON anime(created_at DESC);
