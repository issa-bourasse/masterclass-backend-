import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// Follow a user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { followerId, followingId } = req.body;
    const db = getDb();

    if (!followerId || !followingId) {
      return res.status(400).json({ error: 'followerId and followingId are required' });
    }

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if the user to follow exists
    const users = await db`SELECT id FROM users WHERE id = ${followingId}`;
    if (users.length === 0) {
      return res.status(404).json({ error: 'User to follow not found' });
    }

    // Create follow relationship
    await db`
      INSERT INTO followers (follower_id, following_id)
      VALUES (${followerId}, ${followingId})
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `;

    // Get follower count
    const countResult = await db`
      SELECT COUNT(*) as count FROM followers WHERE following_id = ${followingId}
    `;

    res.json({ 
      success: true, 
      message: 'Followed successfully',
      followerCount: parseInt(countResult[0].count)
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { followerId, followingId } = req.body;
    const db = getDb();

    if (!followerId || !followingId) {
      return res.status(400).json({ error: 'followerId and followingId are required' });
    }

    await db`
      DELETE FROM followers
      WHERE follower_id = ${followerId} AND following_id = ${followingId}
    `;

    // Get updated follower count
    const countResult = await db`
      SELECT COUNT(*) as count FROM followers WHERE following_id = ${followingId}
    `;

    res.json({ 
      success: true, 
      message: 'Unfollowed successfully',
      followerCount: parseInt(countResult[0].count)
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Check if user is following another user
router.get('/check', async (req: Request, res: Response) => {
  try {
    const { followerId, followingId } = req.query;
    const db = getDb();

    if (!followerId || !followingId) {
      return res.status(400).json({ error: 'followerId and followingId are required' });
    }

    const result = await db`
      SELECT id FROM followers 
      WHERE follower_id = ${followerId} AND following_id = ${followingId}
    `;

    res.json({ isFollowing: result.length > 0 });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// Get follower count for a user
router.get('/count/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    const [followers, following] = await Promise.all([
      db`SELECT COUNT(*) as count FROM followers WHERE following_id = ${userId}`,
      db`SELECT COUNT(*) as count FROM followers WHERE follower_id = ${userId}`,
    ]);

    res.json({
      followers: parseInt(followers[0].count),
      following: parseInt(following[0].count),
    });
  } catch (error) {
    console.error('Error getting follow counts:', error);
    res.status(500).json({ error: 'Failed to get follow counts' });
  }
});

export { router as followRoutes };
