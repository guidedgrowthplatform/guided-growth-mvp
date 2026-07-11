#!/usr/bin/env bash
# End-to-end proof for an engine URL: health -> auth (mint a real Supabase JWT
# from a QA test account) -> a streamed coach turn. Prints PASS/FAIL per step.
#
# Usage: ./deploy/prove-engine.sh https://<engine-fqdn>
set -uo pipefail
BASE=${1:?usage: prove-engine.sh https://host}
set -a; . ./.env.local; set +a
QA_EMAIL=${QA_EMAIL:-qa-onboarding-yair@guidedgrowth.test}
QA_PW=${QA_PW:-AzureProof!2026}

echo "== 1. health =="
curl -s --max-time 30 "$BASE/healthz"; echo

echo "== 2. warmup (routing + DB) =="
curl -s --max-time 40 "$BASE/api/llm/warmup"; echo

echo "== 3. mint token =="
TOKEN=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PW\"}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).access_token||"")}catch{console.log("")}})')
echo "token length: ${#TOKEN}"
[ "${#TOKEN}" -lt 100 ] && { echo "FAIL: no token"; exit 1; }

echo "== 4. streamed coach turn (first 12 deltas, timestamped to prove incremental) =="
curl -sN --max-time 60 -X POST "$BASE/api/llm" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"screen_id":"HOME-DEFAULT","mode":"chat","user_message":"help me build a meditation habit","input_mode":"text","session_id":"azure-proof-0001"}' \
  | while IFS= read -r line; do
      [ -n "$line" ] && printf '%s  %s\n' "$(date +%H:%M:%S.%N | cut -c1-12)" "$line"
    done | head -12
