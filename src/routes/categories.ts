import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// Get all categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const categories = await db`
      SELECT 
        c.*,
        COUNT(s.id) FILTER (WHERE s.is_live = true) as live_count
      FROM categories c
      LEFT JOIN streams s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get category by slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const db = getDb();

    const categories = await db`
      SELECT * FROM categories WHERE slug = ${slug}
    `;

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(categories[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Get streams by category
router.get('/:slug/streams', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { limit = 20, offset = 0, liveOnly = 'true' } = req.query;
    const db = getDb();

    // First get the category
    const categories = await db`
      SELECT id FROM categories WHERE slug = ${slug}
    `;

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryId = categories[0].id;
    const showLiveOnly = liveOnly === 'true';

    const streams = await db`
      SELECT 
        s.*,
        u.username,
        u.avatar_url,
        c.name as category_name,
        c.slug as category_slug
      FROM streams s
      JOIN users u ON s.user_id = u.id
      JOIN categories c ON s.category_id = c.id
      WHERE s.category_id = ${categoryId}
        ${showLiveOnly ? db`AND s.is_live = true` : db``}
      ORDER BY s.viewer_count DESC, s.started_at DESC
      LIMIT ${Number(limit)}
      OFFSET ${Number(offset)}
    `;

    res.json(streams);
  } catch (error) {
    console.error('Error fetching category streams:', error);
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Get popular categories (by live stream count)
router.get('/popular/list', async (req: Request, res: Response) => {
  try {
    const { limit = 6 } = req.query;
    const db = getDb();

    const categories = await db`
      SELECT 
        c.*,
        COUNT(s.id) FILTER (WHERE s.is_live = true) as live_count,
        COALESCE(SUM(s.viewer_count) FILTER (WHERE s.is_live = true), 0) as total_viewers
      FROM categories c
      LEFT JOIN streams s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY live_count DESC, total_viewers DESC
      LIMIT ${Number(limit)}
    `;

    res.json(categories);
  } catch (error) {
    console.error('Error fetching popular categories:', error);
    res.status(500).json({ error: 'Failed to fetch popular categories' });
  }
});

export { router as categoryRoutes };
