-- Consolidate the earlier per-message layout into one rolling transcript per agent.
BEGIN;

ALTER TABLE agent_chat_history ADD COLUMN IF NOT EXISTS messages jsonb;
ALTER TABLE agent_chat_history ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE agent_chat_history
SET messages = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', message_id,
      'role', CASE WHEN role = 'user' THEN 'user' ELSE 'agent' END,
      'content', content,
      'time', created_at::text,
      'response', response,
      'toolCards', tool_cards
    ) || COALESCE(details, '{}'::jsonb)
  )
),
updated_at = COALESCE(updated_at, created_at)
WHERE messages IS NULL;

WITH transcripts AS (
  SELECT
    history.agent_id,
    MIN(history.id) AS keep_id,
    jsonb_agg(message ORDER BY history.created_at, history.id) AS messages,
    MIN(history.created_at) AS created_at,
    MAX(history.created_at) AS updated_at,
    MAX(history.expires_at) AS expires_at
  FROM agent_chat_history AS history
  CROSS JOIN LATERAL jsonb_array_elements(history.messages) AS message
  GROUP BY history.agent_id
)
UPDATE agent_chat_history AS history
SET messages = transcripts.messages,
    created_at = transcripts.created_at,
    updated_at = transcripts.updated_at,
    expires_at = transcripts.expires_at
FROM transcripts
WHERE history.id = transcripts.keep_id;

DELETE FROM agent_chat_history AS history
USING (
  SELECT agent_id, MIN(id) AS keep_id
  FROM agent_chat_history
  GROUP BY agent_id
) AS keepers
WHERE history.agent_id = keepers.agent_id
  AND history.id <> keepers.keep_id;

ALTER TABLE agent_chat_history ALTER COLUMN messages SET NOT NULL;
ALTER TABLE agent_chat_history ALTER COLUMN messages SET DEFAULT '[]'::jsonb;
ALTER TABLE agent_chat_history ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE agent_chat_history ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE agent_chat_history
  DROP CONSTRAINT IF EXISTS agent_chat_history_message_id_unique;
DROP INDEX IF EXISTS agent_chat_history_agent_created_idx;
ALTER TABLE agent_chat_history
  DROP COLUMN IF EXISTS message_id,
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS content,
  DROP COLUMN IF EXISTS response,
  DROP COLUMN IF EXISTS tool_cards,
  DROP COLUMN IF EXISTS details;

CREATE UNIQUE INDEX IF NOT EXISTS agent_chat_history_agent_id_unique
  ON agent_chat_history (agent_id);

COMMIT;
