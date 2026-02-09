import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { StreamClient as GetStreamClient } from '@stream-io/node-sdk';

const router = Router();

// Initialize GetStream client
const getStreamClient = (): GetStreamClient | null => {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.warn('GetStream API credentials not configured');
    return null;
  }
  
  return new GetStreamClient(apiKey, apiSecret);
};

// Get all live streams
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { limit = 20, offset = 0, category } = req.query;

    let streams;
    
    if (category) {
      streams = await db`
        SELECT 
          s.id,
          s.title,
          s.description,
          s.thumbnail_url,
          s.is_live,
          s.viewer_count,
          s.started_at,
          s.category_id,
          u.id as user_id,
          u.username,
          u.avatar_url,
          c.name as category_name,
          c.slug as category_slug
        FROM streams s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.is_live = true AND c.slug = ${category}
        ORDER BY s.viewer_count DESC, s.started_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    } else {
      streams = await db`
        SELECT 
          s.id,
          s.title,
          s.description,
          s.thumbnail_url,
          s.is_live,
          s.viewer_count,
          s.started_at,
          s.category_id,
          u.id as user_id,
          u.username,
          u.avatar_url,
          c.name as category_name,
          c.slug as category_slug
        FROM streams s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.is_live = true
        ORDER BY s.viewer_count DESC, s.started_at DESC
        LIMIT ${Number(limit)}
        OFFSET ${Number(offset)}
      `;
    }

    res.json(streams);
  } catch (error) {
    console.error('Error fetching streams:', error);
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Get stream by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const streams = await db`
      SELECT 
        s.*,
        u.username,
        u.avatar_url,
        u.bio as user_bio
      FROM streams s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${id}
    `;

    if (streams.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json(streams[0]);
  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

// Get stream by user ID (current live stream)
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    const streams = await db`
      SELECT s.*, u.username, u.avatar_url
      FROM streams s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ${userId} AND s.is_live = true
      LIMIT 1
    `;

    if (streams.length === 0) {
      return res.status(404).json({ error: 'No active stream found' });
    }

    res.json(streams[0]);
  } catch (error) {
    console.error('Error fetching user stream:', error);
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

// Create/start a new stream
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, title, description } = req.body;
    const db = getDb();

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    // Check if user already has a live stream
    const existingStreams = await db`
      SELECT id FROM streams WHERE user_id = ${userId} AND is_live = true
    `;

    if (existingStreams.length > 0) {
      return res.status(400).json({ error: 'User already has an active stream' });
    }

    // Create new stream
    const streams = await db`
      INSERT INTO streams (user_id, title, description, is_live, started_at)
      VALUES (${userId}, ${title}, ${description || null}, true, NOW())
      RETURNING *
    `;

    // Update user's is_live status
    await db`
      UPDATE users SET is_live = true, updated_at = NOW()
      WHERE id = ${userId}
    `;

    res.status(201).json(streams[0]);
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Update stream
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, thumbnail_url } = req.body;
    const db = getDb();

    const streams = await db`
      UPDATE streams
      SET 
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        thumbnail_url = COALESCE(${thumbnail_url}, thumbnail_url)
      WHERE id = ${id}
      RETURNING *
    `;

    if (streams.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json(streams[0]);
  } catch (error) {
    console.error('Error updating stream:', error);
    res.status(500).json({ error: 'Failed to update stream' });
  }
});

// End stream
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const streams = await db`
      UPDATE streams
      SET is_live = false, ended_at = NOW()
      WHERE id = ${id}
      RETURNING user_id
    `;

    if (streams.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Update user's is_live status
    await db`
      UPDATE users SET is_live = false, updated_at = NOW()
      WHERE id = ${streams[0].user_id}
    `;

    res.json({ success: true, message: 'Stream ended' });
  } catch (error) {
    console.error('Error ending stream:', error);
    res.status(500).json({ error: 'Failed to end stream' });
  }
});

// Generate GetStream token for video streaming
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const client = getStreamClient();
    if (!client) {
      return res.status(500).json({ error: 'Stream service not configured' });
    }

    // Create user token for GetStream
    const token = client.generateUserToken({ user_id: userId });

    res.json({ token });
  } catch (error) {
    console.error('Error generating stream token:', error);
    res.status(500).json({ error: 'Failed to generate stream token' });
  }
});

// Update viewer count
router.patch('/:id/viewers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'join' or 'leave'
    const db = getDb();

    if (!['join', 'leave'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const increment = action === 'join' ? 1 : -1;

    const streams = await db`
      UPDATE streams
      SET viewer_count = GREATEST(0, viewer_count + ${increment})
      WHERE id = ${id}
      RETURNING viewer_count
    `;

    if (streams.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    res.json({ viewerCount: streams[0].viewer_count });
  } catch (error) {
    console.error('Error updating viewer count:', error);
    res.status(500).json({ error: 'Failed to update viewer count' });
  }
});

export { router as streamRoutes };
