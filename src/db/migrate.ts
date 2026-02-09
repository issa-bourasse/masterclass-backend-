import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to Neon database...');
  const sql = neon(databaseUrl);

  try {
    console.log('Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS followers CASCADE`;
    await sql`DROP TABLE IF EXISTS streams CASCADE`;
    await sql`DROP TABLE IF EXISTS categories CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;

    console.log('Creating users table...');
    await sql`
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

    console.log('Creating categories table...');
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('Creating streams table...');
    await sql`
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
      )
    `;

    console.log('Creating followers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS followers (
        id SERIAL PRIMARY KEY,
        follower_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        following_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      )
    `;

    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_streams_is_live ON streams(is_live)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_streams_category ON streams(category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_is_live ON users(is_live)`;

    console.log('Inserting default categories...');
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Gaming', 'gaming', 'gamepad-2') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Music', 'music', 'music') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Art', 'art', 'palette') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Just Chatting', 'just-chatting', 'message-circle') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Software Development', 'software-development', 'code') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Food & Drink', 'food-drink', 'utensils') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Sports', 'sports', 'trophy') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Education', 'education', 'graduation-cap') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Science & Technology', 'science-technology', 'flask-conical') ON CONFLICT (slug) DO NOTHING`;
    await sql`INSERT INTO categories (name, slug, icon) VALUES ('Travel & Outdoors', 'travel-outdoors', 'map') ON CONFLICT (slug) DO NOTHING`;

    console.log('✅ Migration completed successfully!');
    
    // Verify tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('\nCreated tables:');
    tables.forEach((t: { table_name: string }) => console.log(`  - ${t.table_name}`));

    const categories = await sql`SELECT * FROM categories`;
    console.log(`\nCategories: ${categories.length} loaded`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
