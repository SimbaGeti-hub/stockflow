#!/usr/bin/env bash
# Checks receiving, adjusting, history, permissions, concurrency, and the ledger rules.
# The backend must be running on port 8081.
API=http://localhost:8081/api/v1
json='Content-Type: application/json'
login() { curl -s -X POST $API/auth/login -H "$json" -d "$1"; }
code() { curl -s -o /dev/null -w "%{http_code}\n" "$@"; }
psqlq() { docker exec -i stockflow-db psql -P pager=off -U stockflow -d stockflow -c "$1" 2>&1; }

OWNER=$(login '{"email":"owner@example.com","password":"StrongPass123"}')
TOKEN=$(echo "$OWNER" | jq -r '.accessToken // empty')
BID=$(echo "$OWNER" | jq -r '.businessId // empty')
if [ -z "$TOKEN" ]; then
  echo "STOP: could not sign in. Is the backend running on port 8081?"
  exit 1
fi
auth="Authorization: Bearer $TOKEN"

SKU="WATER-$(date +%s)"
PROD=$(curl -s -X POST $API/products -H "$json" -H "$auth" -d "{\"name\":\"Water 1L\",\"sku\":\"$SKU\",\"costPrice\":800,\"sellingPrice\":1500,\"reorderThreshold\":24}")
PROD_ID=$(echo "$PROD" | jq -r '.id // empty')
if [ -z "$PROD_ID" ]; then
  echo "STOP: could not create the test product."
  echo "$PROD"
  exit 1
fi
echo "Test product: $SKU"

echo "--- 1: new product has no stock (expect onHand 0 and OUT_OF_STOCK)"
curl -s "$API/inventory/stock?search=$SKU" -H "$auth" | jq '.content[0] | {sku, onHand, status}'

echo "--- 2: receive 10 at cost 800 (expect balanceAfter 10)"
curl -s -X POST $API/inventory/receipts -H "$json" -H "$auth" \
  -d "{\"notes\":\"First delivery\",\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":10,\"unitCost\":800}]}" \
  | jq '.lines[0] | {sku, quantityChange, balanceAfter}'

echo "--- 3: receive 5 with no unit cost (expect balanceAfter 15)"
curl -s -X POST $API/inventory/receipts -H "$json" -H "$auth" \
  -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":5}]}" \
  | jq '.lines[0] | {balanceAfter}'

echo "--- 4: bad receipts (expect 400, 404, 400)"
code -X POST $API/inventory/receipts -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":0}]}"
code -X POST $API/inventory/receipts -H "$json" -H "$auth" -d '{"items":[{"productId":"00000000-0000-0000-0000-000000000001","quantity":1}]}'
code -X POST $API/inventory/receipts -H "$json" -H "$auth" -d '{"items":[]}'

echo "--- 5: adjust by -3 with a reason (expect balanceAfter 12)"
curl -s -X POST $API/inventory/adjustments -H "$json" -H "$auth" \
  -d "{\"productId\":\"$PROD_ID\",\"quantityChange\":-3,\"reason\":\"Damaged in storage\"}" \
  | jq '{quantityChange, balanceAfter}'

echo "--- 6: bad adjustments: too much, zero, no reason (expect 409, 400, 400)"
code -X POST $API/inventory/adjustments -H "$json" -H "$auth" -d "{\"productId\":\"$PROD_ID\",\"quantityChange\":-100,\"reason\":\"Too much\"}"
code -X POST $API/inventory/adjustments -H "$json" -H "$auth" -d "{\"productId\":\"$PROD_ID\",\"quantityChange\":0,\"reason\":\"Nothing\"}"
code -X POST $API/inventory/adjustments -H "$json" -H "$auth" -d "{\"productId\":\"$PROD_ID\",\"quantityChange\":-1}"

echo "--- 7: history, newest first (expect adjustment 12, receipt 15, receipt 10)"
curl -s "$API/inventory/movements?productId=$PROD_ID" -H "$auth" \
  | jq -c '.content[] | {movementType, quantityChange, balanceAfter, createdBy}'

echo "--- 8: low stock filter (expect totalElements 1 and LOW_STOCK)"
curl -s "$API/inventory/stock?lowStock=true&search=$SKU" -H "$auth" | jq '{totalElements, status: .content[0].status}'

echo "--- 9: staff can read but not change, and cost is hidden (expect 200, null, 403)"
STAFF=$(login "{\"email\":\"other@example.com\",\"password\":\"StrongPass123\",\"businessId\":\"$BID\"}")
STOKEN=$(echo "$STAFF" | jq -r '.accessToken // empty')
if [ -z "$STOKEN" ]; then
  echo "skipped: staff sign-in failed (run scripts/test-catalog.sh first)"
else
  code "$API/inventory/stock?search=$SKU" -H "Authorization: Bearer $STOKEN"
  curl -s "$API/inventory/movements?productId=$PROD_ID" -H "Authorization: Bearer $STOKEN" | jq '.content[0].unitCost'
  code -X POST $API/inventory/receipts -H "$json" -H "Authorization: Bearer $STOKEN" -d "{\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}"
fi

echo "--- 10: 20 simultaneous adjustments of -1 against a balance of 12 (expect 12 x 201 and 8 x 409)"
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/inventory/adjustments -H "$json" -H "$auth" \
    -d "{\"productId\":\"$PROD_ID\",\"quantityChange\":-1,\"reason\":\"concurrency test $i\"}" &
done | sort | uniq -c
wait

echo "--- 11: final balance is exactly 0 and never negative (expect onHand 0, OUT_OF_STOCK)"
curl -s "$API/inventory/stock?search=$SKU" -H "$auth" | jq '.content[0] | {onHand, status}'

echo "--- 12: stock level equals the sum of the ledger (expect level 0 and ledger_sum 0)"
psqlq "select sl.quantity as level, (select coalesce(sum(m.quantity_change), 0) from stock_movements m where m.product_id = sl.product_id) as ledger_sum from stock_levels sl where sl.product_id = '$PROD_ID';"

echo "--- 13: the ledger cannot be edited or deleted (expect two append-only errors)"
psqlq "update stock_movements set quantity_change = 99 where product_id = '$PROD_ID';" | head -2
psqlq "delete from stock_movements where product_id = '$PROD_ID';" | head -2
