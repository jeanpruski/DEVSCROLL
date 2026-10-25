import { transaction } from '@/lib/db';

/** Archive old telemetry counts, then delete the detailed events in the same transaction. */
export async function runMaintenance(now = new Date()) {
  return transaction(async (c) => {
    const locked = (await c.query('SELECT pg_try_advisory_xact_lock(730442062) acquired')).rows[0].acquired;
    if (!locked) return { skipped: true, exposuresDeleted: 0, sessionsDeleted: 0 };
    const cutoff = new Date(now.getTime() - 90 * 86_400_000);
    const selected = (
      await c.query(
        'SELECT id FROM exposures WHERE created_at<$1 ORDER BY created_at LIMIT 10000 FOR UPDATE SKIP LOCKED',
        [cutoff],
      )
    ).rows.map((r) => r.id);
    if (selected.length) {
      await c.query(
        `INSERT INTO exposure_rollups(user_id,day,exposure_count,qualified_count,visible_ms)
        SELECT user_id,(created_at AT TIME ZONE 'UTC')::date,count(*),count(*) FILTER(WHERE qualified),sum(visible_ms)
        FROM exposures WHERE id=ANY($1::uuid[]) GROUP BY user_id,(created_at AT TIME ZONE 'UTC')::date
        ON CONFLICT(user_id,day) DO UPDATE SET exposure_count=exposure_rollups.exposure_count+EXCLUDED.exposure_count,
        qualified_count=exposure_rollups.qualified_count+EXCLUDED.qualified_count,visible_ms=exposure_rollups.visible_ms+EXCLUDED.visible_ms`,
        [selected],
      );
      await c.query('DELETE FROM exposures WHERE id=ANY($1::uuid[])', [selected]);
    }
    const sessions = await c.query(
      'DELETE FROM feed_sessions s WHERE last_active_at<$1 AND NOT EXISTS(SELECT 1 FROM exposures e WHERE e.session_id=s.id)',
      [cutoff],
    );
    return { skipped: false, exposuresDeleted: selected.length, sessionsDeleted: sessions.rowCount ?? 0 };
  });
}
