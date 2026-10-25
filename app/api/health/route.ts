import { pool } from '@/lib/db';
export async function GET() {
  try {
    await pool.query('SELECT 1');
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
