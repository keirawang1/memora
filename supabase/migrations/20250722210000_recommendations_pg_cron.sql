-- Free-tier scheduling via pg_cron + pg_net (no Render).
-- Invokes batched Edge Functions. Set vault secrets first (see services/recommendations/README.md).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  base_url text;
  service_key text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF base_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Vault secrets project_url / service_role_key missing — skip %', fn_name;
    RETURN NULL;
  END IF;

  base_url := rtrim(base_url, '/');

  SELECT net.http_post(
    url := base_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_edge_function(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text) TO postgres;

DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('memora-sync-catalog', 'memora-refresh-recs')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'memora-sync-catalog',
  '*/15 * * * *',
  $$SELECT public.invoke_edge_function('sync-catalog');$$
);

SELECT cron.schedule(
  'memora-refresh-recs',
  '0 * * * *',
  $$SELECT public.invoke_edge_function('refresh-recs');$$
);
