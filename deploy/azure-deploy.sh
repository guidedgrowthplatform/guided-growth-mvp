#!/usr/bin/env bash
# Create or update the Guided Growth engine Container App from a built ACR image.
# Sources ./.env.local for secret values, maps each to an ACA secret, and wires
# the container's env vars to reference them. Idempotent: create on first run,
# update on subsequent runs. Prints the live https FQDN.
#
# Usage:
#   IMAGE_TAG=api-smoke ./deploy/azure-deploy.sh
#   APP=gg-engine IMAGE_TAG=full ./deploy/azure-deploy.sh
set -euo pipefail

RG=${RG:-gg-engine}
APP=${APP:-gg-engine}
ENVNAME=${ENVNAME:-gg-engine-env}
ACR=${ACR:-$(cat /tmp/gg-acr-name.txt)}
IMAGE_TAG=${IMAGE_TAG:-api-smoke}
IMAGE="$ACR.azurecr.io/gg-engine:$IMAGE_TAG"

# Load secret values without echoing them.
set -a; . ./.env.local; set +a

# Server-side vars to surface as ACA secrets (only those actually set are used).
SERVER_VARS=(
  SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DATABASE_URL
  OPENAI_API_KEY CARTESIA_API_KEY CARTESIA_VOICE_ID SONIOX_API_KEY
  VAPI_PRIVATE_KEY VAPI_WEBHOOK_SECRET VAPI_WEBHOOK_BASE_URL
  GITLAB_TOKEN GITLAB_PROJECT_ID RESEND_API_KEY RESEND_FROM_EMAIL FEEDBACK_ALERT_TO
  LLM_PROVIDER AZURE_OPENAI_ENDPOINT AZURE_OPENAI_KEY AZURE_OPENAI_API_VERSION
  AZURE_OPENAI_DEPLOYMENT_ONBOARDING AZURE_OPENAI_DEPLOYMENT_DEFAULT
)
SECRETS=(); ENVREFS=()
for v in "${SERVER_VARS[@]}"; do
  val="${!v:-}"
  [ -z "$val" ] && continue
  sname=$(echo "$v" | tr 'A-Z_' 'a-z-')
  SECRETS+=("$sname=$val")
  ENVREFS+=("$v=secretref:$sname")
done
ENVREFS+=("NODE_ENV=production" "PORT=8080")

ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)

if az containerapp show -n "$APP" -g "$RG" >/dev/null 2>&1; then
  echo "[deploy] updating $APP -> $IMAGE"
  az containerapp secret set -n "$APP" -g "$RG" --secrets "${SECRETS[@]}" -o none
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" \
    --set-env-vars "${ENVREFS[@]}" -o none
else
  echo "[deploy] creating $APP -> $IMAGE"
  az containerapp create -n "$APP" -g "$RG" \
    --environment "$ENVNAME" \
    --image "$IMAGE" \
    --registry-server "$ACR.azurecr.io" \
    --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --target-port 8080 --ingress external \
    --transport http \
    --min-replicas 0 --max-replicas 3 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "${SECRETS[@]}" \
    --env-vars "${ENVREFS[@]}" -o none
fi

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)
echo "https://$FQDN"
