-- ============================================================
-- Resync properties_id_seq with the data
-- ============================================================
--
-- properties.id already defaults to nextval('properties_id_seq'), but both
-- clients have been computing `max(id) + 1` themselves and inserting an
-- explicit id. Supplying an explicit value does not advance the sequence, so
-- properties_id_seq has been sitting still while the table grew past it.
--
-- That is why nobody can simply stop sending the id: the first insert that
-- relied on the default would draw a number already taken and fail on the
-- primary key.
--
-- This moves the sequence past the highest existing id. Idempotent — running
-- it twice is harmless, and running it when the sequence is already correct
-- changes nothing.
--
-- Run this BEFORE deploying the client change that stops sending an id.
-- (The client falls back to explicit ids if the sequence is still behind, so
-- the wrong order degrades rather than breaks — but don't rely on that.)

SELECT setval(
    pg_get_serial_sequence('public.properties', 'id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.properties), 0), 1),
    true    -- next nextval() returns max+1
);

-- Confirm: last_value should now be >= the largest id in the table.
SELECT (SELECT MAX(id) FROM public.properties)          AS max_existing_id,
       (SELECT last_value FROM properties_id_seq)       AS sequence_at,
       CASE WHEN (SELECT last_value FROM properties_id_seq)
                 >= COALESCE((SELECT MAX(id) FROM public.properties), 0)
            THEN 'OK — safe to stop sending explicit ids'
            ELSE 'STILL BEHIND — do not deploy the client change'
       END AS verdict;
