CREATE TABLE generation_attempts (
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES generation_jobs(id),
 retry_cycle integer NOT NULL,
 attempt integer NOT NULL,
 state text NOT NULL DEFAULT 'processing',
 call_started_at timestamptz,
 sources jsonb NOT NULL DEFAULT '[]',
 usage jsonb,
 response_id text,
 response_model text,
 estimated_cost_cents integer,
 cost_unknown boolean NOT NULL DEFAULT false,
 error_code text,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(job_id,retry_cycle,attempt)
);
