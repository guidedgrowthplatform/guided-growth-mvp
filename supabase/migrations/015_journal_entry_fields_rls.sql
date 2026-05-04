-- journal_entry_fields had RLS enabled in 006 but no policy defined.
-- Browser-side embedded selects returned empty arrays. Service-role API bypassed RLS so this stayed latent.

CREATE POLICY "user_isolation" ON journal_entry_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_fields.entry_id
        AND je.user_id = auth.uid()
    )
  );
