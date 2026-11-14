import { Elysia } from 'elysia';
import { authenticatedUser } from '../security/session.js';
import { AssistantError } from '../ai/errors.js';
import { cashierRevenue, reportBounds } from '../reports/cashiers.js';

export const cashierReportRoutes = new Elysia({ prefix: '/cashier-reports' })
  .get('/', async ({ request, query, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      const user = await authenticatedUser(request);
      if (user.role !== 'admin') {
        set.status = 403;
        return { success: false, message: 'Laporan ini hanya tersedia untuk administrator.' };
      }
      const start = query.start || '';
      const end = query.end || '';
      try { reportBounds(start, end); } catch (error) {
        set.status = 400;
        return { success: false, message: (error as Error).message };
      }
      return { success: true, data: await cashierRevenue(start, end) };
    } catch (error) {
      set.status = error instanceof AssistantError ? error.status : 503;
      return { success: false, message: error instanceof AssistantError && error.status === 401
        ? 'Sesi sudah tidak berlaku. Silakan masuk kembali.' : 'Laporan belum dapat dimuat. Silakan coba lagi.' };
    }
  });
