#!/bin/sh
set -eu

server_url="${KEYCLOAK_SERVER_URL:-http://keycloak:8080}"
realm="${KEYCLOAK_REALM:-west-santo}"
client_id="${KEYCLOAK_CLIENT_ID:-west-santo-web}"
client_secret="${KEYCLOAK_CLIENT_SECRET:-replace-with-keycloak-client-secret}"
app_base_url="${APP_BASE_URL:-http://localhost:3000}"
bootstrap_mode="${KEYCLOAK_BOOTSTRAP_MODE:-production}"
seed_login_email="${KEYCLOAK_DEV_LOGIN_EMAIL:-}"
seed_login_password="${KEYCLOAK_DEV_LOGIN_PASSWORD:-}"
google_client_id="${KEYCLOAK_GOOGLE_CLIENT_ID:-}"
google_client_secret="${KEYCLOAK_GOOGLE_CLIENT_SECRET:-}"
google_hosted_domain="${KEYCLOAK_GOOGLE_HOSTED_DOMAIN:-}"

realm_exists() {
  /opt/keycloak/bin/kcadm.sh get "realms/$realm" >/dev/null 2>&1
}

client_uuid() {
  /opt/keycloak/bin/kcadm.sh get clients -r "$realm" -q "clientId=$client_id" --fields id --format csv --noquotes | tail -n 1
}

upsert_client() {
  existing_client_id="$(client_uuid)"

  if [ -n "$existing_client_id" ]; then
    /opt/keycloak/bin/kcadm.sh update "clients/$existing_client_id" -r "$realm" \
      -s enabled=true \
      -s protocol=openid-connect \
      -s publicClient=false \
      -s secret="$client_secret" \
      -s directAccessGrantsEnabled=false \
      -s serviceAccountsEnabled=false \
      -s standardFlowEnabled=true \
      -s implicitFlowEnabled=false \
      -s 'redirectUris=["'"$app_base_url"'/api/auth/callback/keycloak"]' \
      -s 'webOrigins=["'"$app_base_url"'"]' \
      -s 'attributes."post.logout.redirect.uris"="'"$app_base_url"'"' >/dev/null
  else
    /opt/keycloak/bin/kcadm.sh create clients -r "$realm" \
      -s "clientId=$client_id" \
      -s enabled=true \
      -s protocol=openid-connect \
      -s publicClient=false \
      -s secret="$client_secret" \
      -s directAccessGrantsEnabled=false \
      -s serviceAccountsEnabled=false \
      -s standardFlowEnabled=true \
      -s implicitFlowEnabled=false \
      -s 'redirectUris=["'"$app_base_url"'/api/auth/callback/keycloak"]' \
      -s 'webOrigins=["'"$app_base_url"'"]' \
      -s 'attributes."post.logout.redirect.uris"="'"$app_base_url"'"' >/dev/null
  fi
}

upsert_google_idp() {
  if [ -z "$google_client_id" ] || [ -z "$google_client_secret" ]; then
    echo "Keycloak bootstrap: Google identity provider not configured; skipping."
    return
  fi

  existing_alias="$(/opt/keycloak/bin/kcadm.sh get identity-provider/instances -r "$realm" --fields alias --format csv --noquotes 2>/dev/null | grep '^google$' || true)"

  hosted_domain_value="${google_hosted_domain:-}"

  if [ -n "$existing_alias" ]; then
    /opt/keycloak/bin/kcadm.sh update "identity-provider/instances/google" -r "$realm" \
      -s providerId=google \
      -s enabled=true \
      -s trustEmail=true \
      -s storeToken=false \
      -s authenticateByDefault=true \
      -s firstBrokerLoginFlowAlias="first broker login" \
      -s 'config.useJwksUrl="true"' \
      -s 'config.guiOrder="1"' \
      -s "config.clientId=$google_client_id" \
      -s "config.clientSecret=$google_client_secret" \
      -s "config.hostedDomain=$hosted_domain_value" >/dev/null
  else
    /opt/keycloak/bin/kcadm.sh create identity-provider/instances -r "$realm" \
      -s alias=google \
      -s providerId=google \
      -s enabled=true \
      -s trustEmail=true \
      -s storeToken=false \
      -s authenticateByDefault=true \
      -s firstBrokerLoginFlowAlias="first broker login" \
      -s 'config.useJwksUrl="true"' \
      -s 'config.guiOrder="1"' \
      -s "config.clientId=$google_client_id" \
      -s "config.clientSecret=$google_client_secret" \
      -s "config.hostedDomain=$hosted_domain_value" >/dev/null
  fi
}

seed_dev_user() {
  if [ "$bootstrap_mode" != "development" ] || [ -z "$seed_login_email" ] || [ -z "$seed_login_password" ]; then
    return
  fi

  user_id="$(/opt/keycloak/bin/kcadm.sh get users -r "$realm" -q "username=$seed_login_email" --fields id --format csv --noquotes | tail -n 1 || true)"

  if [ -z "$user_id" ]; then
    /opt/keycloak/bin/kcadm.sh create users -r "$realm" \
      -s "username=$seed_login_email" \
      -s "email=$seed_login_email" \
      -s "firstName=West" \
      -s "lastName=Admin" \
      -s enabled=true \
      -s emailVerified=true >/dev/null
    user_id="$(/opt/keycloak/bin/kcadm.sh get users -r "$realm" -q "username=$seed_login_email" --fields id --format csv --noquotes | tail -n 1)"
  fi

  /opt/keycloak/bin/kcadm.sh set-password -r "$realm" --userid "$user_id" --new-password "$seed_login_password" >/dev/null
}

until /opt/keycloak/bin/kcadm.sh config credentials \
  --server "$server_url" \
  --realm master \
  --user "${KEYCLOAK_ADMIN_USER:-admin}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD:-admin}" >/dev/null 2>&1
do
  sleep 2
done

if ! realm_exists; then
  /opt/keycloak/bin/kcadm.sh create realms -s "realm=$realm" -s enabled=true -s sslRequired=NONE >/dev/null
fi

upsert_client
upsert_google_idp
seed_dev_user

echo "Keycloak realm '$realm' bootstrapped in $bootstrap_mode mode"
