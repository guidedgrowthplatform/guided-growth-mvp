# Decision: `beat_contexts` Supabase table

**Yair-visible decision — recommend retire, not retain as a derived cache.**

The generated artifacts are deterministic, versioned with the exact contract hash, and bundled with each reader.
A derived database cache would recreate a second deployment surface without reducing reader coupling.
Keep the table frozen only through the documented rollback window while supported releases may still read it.
Disable seed/sync jobs and drop it only after the Phase C/E operational gates confirm no supported consumer remains.
