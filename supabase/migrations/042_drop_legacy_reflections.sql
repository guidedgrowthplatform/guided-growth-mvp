-- Legacy pre-journal reflection tables. Superseded by journal_entries + journal_entry_fields.
-- No active code writes them; only count/cleanup readers remained (removed in same change).
DROP TABLE IF EXISTS reflections CASCADE;
DROP TABLE IF EXISTS reflection_configs CASCADE;
