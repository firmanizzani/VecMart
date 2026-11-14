import { Elysia, t } from 'elysia';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticatedUser, signToken } from '../security/session.js';
import { AssistantError } from '../ai/errors.js';

export const authRoutes = new Elysia({ prefix: '/auth' })
  // Login Cashier / Admin with Email & PIN
  .post('/login', async ({ body, set }) => {
    const emailInput = body.email?.trim().toLowerCase();
    const pinInput = body.pinCode?.trim();

    try {
      const dbUsers = await db.select().from(users);
      const matchedDbUser = dbUsers.find(u => 
        u.email.toLowerCase() === emailInput && u.pinCode === pinInput
      );

      if (matchedDbUser) {
        return {
          success: true,
          message: `Login ${matchedDbUser.role === 'admin' ? 'Admin' : 'Kasir'} Berhasil`,
          token: signToken('session', matchedDbUser.id, {}, 12 * 60 * 60),
          user: {
            id: matchedDbUser.id,
            name: matchedDbUser.name,
            email: matchedDbUser.email,
            role: matchedDbUser.role
          }
        };
      }
    } catch (e: any) {
      if (e instanceof AssistantError) { set.status = e.status; return { success: false, message: e.message }; }
      console.error('DB auth query error:', e.message);
    }

    return {
      success: false,
      message: 'Email atau PIN Kasir/Admin salah!'
    };
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      pinCode: t.String({ pattern: '^[0-9]{6}$', minLength: 6, maxLength: 6 })
    })
  })

  // Verify Active Session
  .get('/me', async ({ request, set }) => {
    try { return { success: true, user: await authenticatedUser(request) }; }
    catch (error) { set.status = error instanceof AssistantError ? error.status : 500; return { success: false, message: error instanceof AssistantError ? error.message : 'Sesi belum dapat diverifikasi.' }; }
  });
