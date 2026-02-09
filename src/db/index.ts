import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Create database connection
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
};

// Lazy initialization of the database connection
let sql: NeonQueryFunction<false, false> | null = null;

export const getDb = (): NeonQueryFunction<false, false> => {
  if (!sql) {
    sql = neon(getDatabaseUrl());
  }
  return sql;
};

// Database schema initialization
export const initializeDatabase = async (): Promise<void> => {
  const db = getDb();
  
  try {
    // Create users table
    await db`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        stream_key VARCHAR(255) UNIQUE,
        is_live BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create streams table
    await db`
      CREATE TABLE IF NOT EXISTS streams (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        is_live BOOLEAN DEFAULT FALSE,
        viewer_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create followers table
    await db`
      CREATE TABLE IF NOT EXISTS followers (
        id SERIAL PRIMARY KEY,
        follower_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        following_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      )
    `;

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};
