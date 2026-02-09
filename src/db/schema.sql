-- StreamHub Database Schema
-- Run this in your Neon database to initialize tables

-- Users table (synced with Clerk)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,      -- Clerk user ID
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    stream_key VARCHAR(255) UNIQUE,
    is_live BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    category_id INTEGER REFERENCES categories(id),
    is_live BOOLEAN DEFAULT FALSE,
    viewer_count INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Followers table
CREATE TABLE IF NOT EXISTS followers (
    id SERIAL PRIMARY KEY,
    follower_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    following_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live);
CREATE INDEX IF NOT EXISTS idx_streams_category ON streams(category_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live);

-- Insert default categories
INSERT INTO categories (name, slug, icon) VALUES 
    ('Gaming', 'gaming', 'gamepad-2'),
    ('Music', 'music', 'music'),
    ('Art', 'art', 'palette'),
    ('Just Chatting', 'just-chatting', 'message-circle'),
    ('Software Development', 'software-development', 'code'),
    ('Food & Drink', 'food-drink', 'utensils'),
    ('Sports', 'sports', 'trophy'),
    ('Education', 'education', 'graduation-cap'),
    ('Science & Technology', 'science-technology', 'flask-conical'),
    ('Travel & Outdoors', 'travel-outdoors', 'map')
ON CONFLICT (slug) DO NOTHING;
