CREATE TABLE generation_budgets (
 month date PRIMARY KEY,
 spent_cents bigint NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
 reserved_cents bigint NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE generation_runs (
 id uuid PRIMARY KEY,
 user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 idempotency_key text NOT NULL,
 payload_hash text NOT NULL,
 dedup_key text NOT NULL,
 payload jsonb NOT NULL,
 provider text NOT NULL,
 model text NOT NULL,
 prompt_version text NOT NULL,
 config_snapshot jsonb NOT NULL,
 warnings jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','partial','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key)
);
CREATE UNIQUE INDEX generation_runs_dedup_idx ON generation_runs(dedup_key) WHERE status IN ('queued','running','succeeded','partial','uncertain');
CREATE INDEX generation_runs_created_idx ON generation_runs(created_at DESC,id);
CREATE TABLE generation_jobs (
 id uuid PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES generation_runs(id),
 position integer NOT NULL CHECK(position BETWEEN 1 AND 5),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','succeeded','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 0,
 retry_cycle integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz,
 lease_token uuid,
 call_started_at timestamptz,
 budget_month date NOT NULL REFERENCES generation_budgets(month),
 reservation_cents integer NOT NULL CHECK(reservation_cents > 0),
 cost_state text NOT NULL DEFAULT 'reserved' CHECK(cost_state IN ('reserved','estimated','released','unknown')),
 estimated_cost_cents integer CHECK(estimated_cost_cents >= 0),
 usage jsonb,
 sources jsonb NOT NULL DEFAULT '[]',
 response_id text,
 response_model text,
 error_code text,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,position)
);
CREATE INDEX generation_jobs_queue_idx ON generation_jobs(state,available_at,created_at);
CREATE INDEX generation_jobs_lease_idx ON generation_jobs(state,locked_until);
CREATE TABLE generation_results (
 job_id uuid PRIMARY KEY REFERENCES generation_jobs(id),
 post_id uuid NOT NULL UNIQUE REFERENCES posts(id),
 fingerprint text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
