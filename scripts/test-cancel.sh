#!/usr/bin/env bash
# Checks the cancelled-sale record. The backend must be running on port 8081.
API=http://localhost:8081/api/v1
json='Content-Type: application/json'
login() { curl -s -X POST $API/auth/login -H "$json" -d "$1"; }
code() { curl -s -o /dev/null -w "%{http_code}\n" "$@"; }
psqlq() { docker exec -i stockflow-db psql -P pager=off -U stockflow -d stockflow -c "$1" 2>&1; }
psqlv() { docker exec -i stockflow-db psql -t -A -U stockflow -d stockflow -c "$1" 2>&1 | head -1; }

OWNER=$(login '{"email":"owner@example.com","password":"StrongPass123"}')
TOKEN=$(echo "$OWNER" | jq -r '.accessToken // empty')
BID=$(echo "$OWNER" | jq -r '.businessId // empty')
if [ -z "$TOKEN" ]; then echo "STOP: could not sign in. Is the backend running on port 8081?"; exit 1; fi
auth="Authorization: Bearer $TOKEN"
S=$(date +%s)

PROD=$(curl -s -X POST $API/products -H "$json" -H "$auth" \
  -d "{\"name\":\"Cancel Me\",\"sku\":\"CANCEL-$S\",\"costPrice\":400,\"sellingPrice\":1000,\"taxRate\":0,\"reorderThreshold\":1}")
PROD_ID=$(echo "$PROD" | jq -r '.id // empty')
if [ -z "$PROD_ID" ]; then echo "STOP: could not create the test product."; echo "$PROD"; exit 1; fi
curl -s -o /dev/null -X POST $API/inventory/receipts -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":5}]}"
SALES_BEFORE=$(psqlv "select count(*) from sales where business_id = '$BID';")

echo "--- 1: record a cancelled sale of 2 items (expect 204)"
code -X POST $API/pos/cancellations -H "$json" -H "$auth" \
  -d "{\"reason\":\"Customer changed their mind\",\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":2}]}"

echo "--- 2: nothing was sold and no stock moved (expect onHand 5 and sales unchanged true)"
SALES_AFTER=$(psqlv "select count(*) from sales where business_id = '$BID';")
curl -s "$API/inventory/stock?search=CANCEL-$S" -H "$auth" | jq '.content[0].onHand'
echo "sales unchanged: $( [ "$SALES_BEFORE" = "$SALES_AFTER" ] && echo true || echo false )"

echo "--- 3: the audit record (expect sale.cancelled, the reason, 2 x Cancel Me, total 2000)"
psqlq "select action, entity_type, details->>'reason' as reason, details->>'summary' as items, details->>'estimatedTotal' as total, user_id is not null as has_user from audit_logs where business_id = '$BID' order by id desc limit 1;"

echo "--- 4: bad requests (expect 400 empty list, 400 unknown product, 400 reason too long)"
code -X POST $API/pos/cancellations -H "$json" -H "$auth" -d '{"items":[]}'
code -X POST $API/pos/cancellations -H "$json" -H "$auth" -d '{"items":[{"productId":"00000000-0000-0000-0000-000000000001","quantity":1}]}'
LONG=$(printf 'x%.0s' $(seq 1 300))
code -X POST $API/pos/cancellations -H "$json" -H "$auth" -d "{\"reason\":\"$LONG\",\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"

echo "--- 5: a mix of unknown and real products still records the real ones (expect 204)"
code -X POST $API/pos/cancellations -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"00000000-0000-0000-0000-000000000001\",\"quantity\":1},{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"

echo "--- 6: no token (expect 401)"
code -X POST $API/pos/cancellations -H "$json" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"

echo "--- 7: another business cannot use our product (expect 400)"
OTHER=$(login '{"email":"other@example.com","password":"StrongPass123"}')
OTOKEN=$(echo "$OTHER" | jq -r '.accessToken // empty')
code -X POST $API/pos/cancellations -H "$json" -H "Authorization: Bearer $OTOKEN" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"

echo "--- 8: staff can record a cancellation in our business (expect 204)"
STAFF=$(login "{\"email\":\"other@example.com\",\"password\":\"StrongPass123\",\"businessId\":\"$BID\"}")
STOKEN=$(echo "$STAFF" | jq -r '.accessToken // empty')
if [ -z "$STOKEN" ]; then
  echo "skipped: staff sign-in failed (run scripts/test-catalog.sh first)"
else
  code -X POST $API/pos/cancellations -H "$json" -H "Authorization: Bearer $STOKEN" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"
fi
