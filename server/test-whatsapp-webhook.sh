#!/bin/bash
# WhatsApp Webhook Test Script
# Usage: ./test-whatsapp-webhook.sh [delivered|read|failed]

STATUS=${1:-delivered}
PAYLOAD="{\"object\":\"whatsapp_business_account\",\"entry\":[{\"changes\":[{\"field\":\"messages\",\"value\":{\"statuses\":[{\"id\":\"msg_test_123\",\"status\":\"$STATUS\",\"timestamp\":\"1234567890\"}]}}]}]}"

# Generate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | sed 's/^.* //')

echo "Testing webhook with status: $STATUS"
echo "Signature: sha256=$SIGNATURE"
echo ""

curl -X POST http://localhost:5001/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"

echo ""
echo "Done!"
