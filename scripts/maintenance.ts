import 'dotenv/config';
import { pool } from '../lib/db';
import { validateConfig } from '../lib/config';
import { runMaintenance } from '../modules/feed/maintenance';

validateConfig();
try {
  let total = 0;
  for (;;) {
    const result = await runMaintenance();
    total += result.exposuresDeleted;
    if (result.skipped || result.exposuresDeleted < 10000) {
      console.log(
        JSON.stringify({
          event: 'maintenance_completed',
          exposuresDeleted: total,
          sessionsDeleted: result.sessionsDeleted,
          skipped: result.skipped,
        }),
      );
      break;
    }
  }
} finally {
  await pool.end();
}
