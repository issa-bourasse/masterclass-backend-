import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { getDb } from '../db';

const router = Router();

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    username?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
}

// Clerk webhook handler
router.post('/clerk', async (req: Request, res: Response) => {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.error('CLERK_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get headers
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET);
    let event: ClerkWebhookEvent;

    try {
      event = wh.verify(req.body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    const db = getDb();
    const { type, data } = event;

    console.log(`Received Clerk webhook: ${type}`);

    switch (type) {
      case 'user.created': {
        const email = data.email_addresses?.[0]?.email_address || '';
        const username = data.username || 
          data.first_name?.toLowerCase() || 
          `user_${data.id.slice(0, 8)}`;

        await db`
          INSERT INTO users (id, username, email, avatar_url)
          VALUES (
            ${data.id},
            ${username},
            ${email},
            ${data.image_url || null}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        
        console.log(`User created: ${data.id}`);
        break;
      }

      case 'user.updated': {
        const email = data.email_addresses?.[0]?.email_address;
        const username = data.username;

        await db`
          UPDATE users
          SET 
            username = COALESCE(${username}, username),
            email = COALESCE(${email}, email),
            avatar_url = COALESCE(${data.image_url}, avatar_url),
            updated_at = NOW()
          WHERE id = ${data.id}
        `;
        
        console.log(`User updated: ${data.id}`);
        break;
      }

      case 'user.deleted': {
        await db`
          DELETE FROM users WHERE id = ${data.id}
        `;
        
        console.log(`User deleted: ${data.id}`);
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as webhookRoutes };
