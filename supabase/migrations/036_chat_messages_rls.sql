BEGIN;

-- Dormant under service_role (bypasses RLS); active only on authenticated conns.
-- JWT claim (not current_anon_id) so it fails closed when absent; assumes 032/026.
CREATE POLICY "anon_isolation" ON public.chat_messages
  FOR ALL
  TO authenticated
  USING      (anon_id = (auth.jwt() ->> 'anon_id')::uuid)
  WITH CHECK (anon_id = (auth.jwt() ->> 'anon_id')::uuid);

CREATE POLICY "service_role_only" ON public.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
