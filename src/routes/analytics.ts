import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// Get user's stream analytics
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { period = '7d' } = req.query; // 7d, 30d, 90d, all
    const db = getDb();

    // Calculate date range
    let dateFilter = '';
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get total streams
    const totalStreams = await db`
      SELECT COUNT(*) as count 
      FROM streams 
      WHERE user_id = ${userId} AND created_at >= ${startDate.toISOString()}
    `;

    // Get total watch time (sum of stream durations)
    const watchTime = await db`
      SELECT 
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 3600), 0) as hours
      FROM streams 
      WHERE user_id = ${userId} 
        AND started_at IS NOT NULL 
        AND created_at >= ${startDate.toISOString()}
    `;

    // Get total views
    const totalViews = await db`
      SELECT COALESCE(SUM(viewer_count), 0) as views
      FROM streams 
      WHERE user_id = ${userId} AND created_at >= ${startDate.toISOString()}
    `;

    // Get peak viewers across all streams
    const peakViewers = await db`
      SELECT COALESCE(MAX(viewer_count), 0) as peak
      FROM streams 
      WHERE user_id = ${userId} AND created_at >= ${startDate.toISOString()}
    `;

    // Get average stream duration
    const avgDuration = await db`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 60), 0) as minutes
      FROM streams 
      WHERE user_id = ${userId} 
        AND started_at IS NOT NULL 
        AND ended_at IS NOT NULL
        AND created_at >= ${startDate.toISOString()}
    `;

    // Get follower growth (new followers in period)
    const followerGrowth = await db`
      SELECT COUNT(*) as count
      FROM followers 
      WHERE following_id = ${userId} AND created_at >= ${startDate.toISOString()}
    `;

    // Get recent streams
    const recentStreams = await db`
      SELECT 
        id, 
        title, 
        viewer_count, 
        started_at, 
        ended_at,
        EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 60 as duration_minutes
      FROM streams 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    res.json({
      period,
      stats: {
        totalStreams: parseInt(totalStreams[0].count),
        totalStreamHours: parseFloat(watchTime[0].hours).toFixed(1),
        totalViews: parseInt(totalViews[0].views),
        peakViewers: parseInt(peakViewers[0].peak),
        avgStreamMinutes: parseFloat(avgDuration[0].minutes).toFixed(0),
        newFollowers: parseInt(followerGrowth[0].count),
      },
      recentStreams,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get platform-wide analytics (for admin/public stats)
router.get('/platform', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const [totalUsers, totalStreams, liveNow, totalFollows] = await Promise.all([
      db`SELECT COUNT(*) as count FROM users`,
      db`SELECT COUNT(*) as count FROM streams`,
      db`SELECT COUNT(*) as count FROM streams WHERE is_live = true`,
      db`SELECT COUNT(*) as count FROM followers`,
    ]);

    res.json({
      totalUsers: parseInt(totalUsers[0].count),
      totalStreams: parseInt(totalStreams[0].count),
      liveNow: parseInt(liveNow[0].count),
      totalFollows: parseInt(totalFollows[0].count),
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

// Get trending streams (most viewers in last 24h)
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { limit = 10 } = req.query;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const trending = await db`
      SELECT 
        s.id,
        s.title,
        s.viewer_count,
        s.is_live,
        s.started_at,
        u.id as user_id,
        u.username,
        u.avatar_url
      FROM streams s
      JOIN users u ON s.user_id = u.id
      WHERE s.created_at >= ${yesterday}
      ORDER BY s.viewer_count DESC
      LIMIT ${Number(limit)}
    `;

    res.json(trending);
  } catch (error) {
    console.error('Error fetching trending:', error);
    res.status(500).json({ error: 'Failed to fetch trending streams' });
  }
});

export { router as analyticsRoutes };
