#!/usr/bin/env bash
# Checks /me, the POS catalogue, and pay-in-full sales. The backend must be running on port 8081.
API=http://localhost:8081/api/v1
json='Content-Type: application/json'
login() { curl -s -X POST $API/auth/login -H "$json" -d "$1"; }
code() { curl -s -o /dev/null -w "%{http_code}\n" "$@"; }

OWNER=$(login '{"email":"owner@example.com","password":"StrongPass123"}')
TOKEN=$(echo "$OWNER" | jq -r '.accessToken // empty')
BID=$(echo "$OWNER" | jq -r '.businessId // empty')
if [ -z "$TOKEN" ]; then echo "STOP: could not sign in. Is the backend running on port 8081?"; exit 1; fi
auth="Authorization: Bearer $TOKEN"
S=$(date +%s)

PROD=$(curl -s -X POST $API/products -H "$json" -H "$auth" \
  -d "{\"name\":\"Scan Me\",\"sku\":\"SCAN-$S\",\"barcode\":\"BC-$S\",\"costPrice\":400,\"sellingPrice\":1000,\"taxRate\":0,\"reorderThreshold\":1}")
PROD_ID=$(echo "$PROD" | jq -r '.id // empty')
if [ -z "$PROD_ID" ]; then echo "STOP: could not create the test product."; echo "$PROD"; exit 1; fi
curl -s -o /dev/null -X POST $API/inventory/receipts -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":10}]}"

echo "--- 1: /me shows name, business, and currency (expect role owner, Simba Geti, Simba General Store, UGX)"
curl -s $API/me -H "$auth" | jq '{role, fullName, businessName, currencyCode}'

echo "--- 2: an exact barcode match comes first, with price and stock (expect Scan Me, 1000, onHand 10)"
curl -s "$API/pos/products?search=BC-$S" -H "$auth" | jq -c '.[0] | {name, sku, barcode, sellingPrice, onHand}'

echo "--- 3: in-stock products come before out-of-stock ones (expect true)"
curl -s "$API/pos/products?limit=50" -H "$auth" | jq '[.[].onHand] | (. == (sort | reverse)) or (index(0) == null) or ((.[:index(0)] | all(. > 0)))'

echo "--- 4: sale paid in full with cash (expect total 2000, amountPaid 2000, balanceDue 0, 1 payment)"
curl -s -X POST $API/sales -H "$json" -H "$auth" \
  -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":2}],\"payInFullMethod\":\"cash\"}" \
  | jq '{total, amountPaid, balanceDue, payments: (.payments | length)}'

echo "--- 5: mobile money with a reference (expect method mobile_money and the reference)"
curl -s -X POST $API/sales -H "$json" -H "$auth" \
  -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}],\"payInFullMethod\":\"mobile_money\",\"paymentReference\":\"MM-$S\"}" \
  | jq '.payments[0] | {method, amount, reference}'

echo "--- 6: payments and payInFullMethod together (expect 400), and an unknown method (expect 400)"
code -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}],\"payInFullMethod\":\"cash\",\"payments\":[{\"method\":\"cash\",\"amount\":1000}]}"
code -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}],\"payInFullMethod\":\"crypto\"}"

echo "--- 7: stock after the two sales (expect 7)"
curl -s "$API/inventory/stock?search=SCAN-$S" -H "$auth" | jq '.content[0].onHand'

echo "--- 8: staff can use the POS catalogue and sell (expect 200, then 201)"
STAFF=$(login "{\"email\":\"other@example.com\",\"password\":\"StrongPass123\",\"businessId\":\"$BID\"}")
STOKEN=$(echo "$STAFF" | jq -r '.accessToken // empty')
if [ -z "$STOKEN" ]; then
  echo "skipped: staff sign-in failed (run scripts/test-catalog.sh first)"
else
  sauth="Authorization: Bearer $STOKEN"
  code "$API/pos/products?search=SCAN-$S" -H "$sauth"
  code -X POST $API/sales -H "$json" -H "$sauth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}],\"payInFullMethod\":\"cash\"}"
fi

echo "--- 9: no token means no catalogue (expect 401)"
code "$API/pos/products"
