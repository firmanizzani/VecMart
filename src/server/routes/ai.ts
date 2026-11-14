import { Elysia, t } from 'elysia';
import { requireAdmin } from '../security/session.js';
import { AssistantError } from '../ai/errors.js';
import { modelName } from '../ai/gemini.js';
import { getUsage } from '../ai/quota.js';
import { handleChat } from '../ai/service.js';
import { chooseProduct, undoChange } from '../ai/stock.js';
import { chooseAction, confirmAction, undoAction } from '../ai/product-actions.js';

type ErrorSet = { status?: number | string; headers: Record<string, string | number | readonly string[]> };
function failed(error: unknown, set: ErrorSet) {
  if (error instanceof AssistantError) {
    set.status = error.status;
    if (error.retryAfter) set.headers['retry-after'] = String(error.retryAfter);
    return { success: false, code: error.code, message: error.message, retryAfter: error.retryAfter };
  }
  set.status = 503;
  // Database/provider details may contain credentials; do not expose raw errors.
  return { success: false, code: 'ASSISTANT_UNAVAILABLE', message: 'Asisten belum dapat memproses permintaan. Periksa koneksi dan konfigurasi server, lalu coba lagi.' };
}
export const aiRoutes = new Elysia({ prefix: '/ai' })
  .get('/status', async ({ request, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      await requireAdmin(request);
      return { success: true, data: { configured: !!process.env.GEMINI_API_KEY?.trim(), model: modelName(), usage: await getUsage() } };
    } catch (error) { return failed(error, set); }
  })
  .post('/chat', async ({ request, body, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await handleChat(user.id, body.requestId, body.message), usage: await getUsage() };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ requestId: t.String({ format: 'uuid' }), message: t.String({ minLength: 1, maxLength: 1000 }) }) })
  .post('/choose-product', async ({ request, body, set }) => {
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await chooseProduct(user.id, body.token, body.productId), usage: await getUsage() };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ token: t.String({ maxLength: 16000 }), productId: t.String({ minLength: 1, maxLength: 200 }) }) })
  .post('/choose-action', async ({ request, body, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await chooseAction(user.id, body.token, body.productId) };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ token: t.String({ maxLength: 16000 }), productId: t.String({ minLength: 1, maxLength: 200 }) }) })
  .post('/confirm', async ({ request, body, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await confirmAction(user.id, body.token) };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ token: t.String({ maxLength: 16000 }) }) })
  .post('/undo-action', async ({ request, body, set }) => {
    set.headers['cache-control'] = 'no-store';
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await undoAction(user.id, body.token) };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ token: t.String({ maxLength: 16000 }) }) })
  .post('/undo', async ({ request, body, set }) => {
    try {
      const user = await requireAdmin(request);
      return { success: true, data: await undoChange(user.id, body.token), usage: await getUsage() };
    } catch (error) { return failed(error, set); }
  }, { body: t.Object({ token: t.String({ maxLength: 16000 }) }) });
