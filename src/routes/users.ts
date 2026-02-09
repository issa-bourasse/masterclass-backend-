import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const users = await db`
      SELECT id, username, email, avatar_url, bio, is_live, created_at
      FROM users
      WHERE id = ${id}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, bio, avatar_url } = req.body;
    const db = getDb();

    const users = await db`
      UPDATE users
      SET 
        username = COALESCE(${username}, username),
        bio = COALESCE(${bio}, bio),
        avatar_url = COALESCE(${avatar_url}, avatar_url),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, username, email, avatar_url, bio, is_live
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user's followers
router.get('/:id/followers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const followers = await db`
      SELECT u.id, u.username, u.avatar_url, f.created_at as followed_at
      FROM followers f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ${id}
      ORDER BY f.created_at DESC
    `;

    res.json(followers);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get users that a user is following
router.get('/:id/following', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const following = await db`
      SELECT u.id, u.username, u.avatar_url, u.is_live, f.created_at as followed_at
      FROM followers f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ${id}
      ORDER BY f.created_at DESC
    `;

    res.json(following);
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Follow a user
router.post('/:id/follow', async (req: Request, res: Response) => {
  try {
    const { id: followingId } = req.params;
    const { followerId } = req.body;
    const db = getDb();

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    await db`
      INSERT INTO followers (follower_id, following_id)
      VALUES (${followerId}, ${followingId})
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `;

    res.json({ success: true, message: 'Followed successfully' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/:id/follow', async (req: Request, res: Response) => {
  try {
    const { id: followingId } = req.params;
    const { followerId } = req.body;
    const db = getDb();

    await db`
      DELETE FROM followers
      WHERE follower_id = ${followerId} AND following_id = ${followingId}
    `;

    res.json({ success: true, message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Generate/get stream key for user
router.post('/:id/stream-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Generate new stream key
    const streamKey = `sk_${uuidv4().replace(/-/g, '')}`;

    const users = await db`
      UPDATE users
      SET stream_key = ${streamKey}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING stream_key
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ streamKey: users[0].stream_key });
  } catch (error) {
    console.error('Error generating stream key:', error);
    res.status(500).json({ error: 'Failed to generate stream key' });
  }
});

export { router as userRoutes };
