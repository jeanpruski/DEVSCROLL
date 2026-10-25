import 'dotenv/config';
import { setTimeout as wait } from 'node:timers/promises';
import { pool } from '../lib/db';
import { generationConfig } from '../modules/generation/config';
import { claimJob, renewLease } from '../modules/generation/service';
import { processGenerationJob } from './generation';
import { runMaintenance } from '../modules/feed/maintenance';

let stopping = false;
const pollMs = Math.max(500, Math.min(60_000, Number(process.env.WORKER_POLL_MS) || 5_000));
process.once('SIGTERM', () => {
  stopping = true;
});
process.once('SIGINT', () => {
  stopping = true;
});
console.info(
  JSON.stringify({
    event: 'worker_start',
    generationMode: generationConfig().mode,
    concurrency: 1,
    recurringGeneration: false,
  }),
);

try {
  let nextMaintenance = 0;
  while (!stopping) {
    if (Date.now() >= nextMaintenance) {
      try {
        console.info(JSON.stringify({ event: 'maintenance_completed', ...(await runMaintenance()) }));
      } catch {
        console.error(JSON.stringify({ event: 'maintenance_failed' }));
      }
      nextMaintenance = Date.now() + 6 * 60 * 60 * 1000;
    }
    const job = await claimJob();
    if (!job) {
      await wait(pollMs);
      continue;
    }
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    try {
      heartbeat = setInterval(() => {
        void renewLease(job)
          .then((renewed) => {
            if (!renewed)
              console.error(JSON.stringify({ event: 'job_lease_lost', jobId: job.id, runId: job.run_id }));
          })
          .catch(() =>
            console.error(
              JSON.stringify({ event: 'job_heartbeat_failed', jobId: job.id, runId: job.run_id }),
            ),
          );
      }, 15_000);
      const outcome = await processGenerationJob(job);
      console.info(JSON.stringify({ event: 'job_completed', jobId: job.id, runId: job.run_id, outcome }));
    } catch {
      // An uncommitted result remains behind a lease and is recovered conservatively after expiry.
      console.error(JSON.stringify({ event: 'job_unexpected_error', jobId: job.id, runId: job.run_id }));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }
} catch {
  console.error(JSON.stringify({ event: 'worker_database_error' }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
