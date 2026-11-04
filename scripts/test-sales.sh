#!/usr/bin/env bash
# Checks sales: totals, tax, snapshots, payments, stock, idempotency, voids, permissions,
# receipts, and a race for the last units. The backend must be running on port 8081.
API=http://localhost:8081/api/v1
json='Content-Type: application/json'
login() { curl -s -X POST $API/auth/login -H "$json" -d "$1"; }
code() { curl -s -o /dev/null -w "%{http_code}\n" "$@"; }
psqlq() { docker exec -i stockflow-db psql -P pager=off -U stockflow -d stockflow -c "$1" 2>&1; }
psqlv() { docker exec -i stockflow-db psql -t -A -U stockflow -d stockflow -c "$1" 2>&1 | head -1; }

OWNER=$(login '{"email":"owner@example.com","password":"StrongPass123"}')
TOKEN=$(echo "$OWNER" | jq -r '.accessToken // empty')
BID=$(echo "$OWNER" | jq -r '.businessId // empty')
if [ -z "$TOKEN" ]; then
  echo "STOP: could not sign in. Is the backend running on port 8081?"
  exit 1
fi
auth="Authorization: Bearer $TOKEN"
S=$(date +%s)

mkprod() { # name sku cost price taxRate
  curl -s -X POST $API/products -H "$json" -H "$auth" \
    -d "{\"name\":\"$1\",\"sku\":\"$2\",\"costPrice\":$3,\"sellingPrice\":$4,\"taxRate\":$5,\"reorderThreshold\":2}" | jq -r '.id // empty'
}
receive() { # productId quantity
  curl -s -o /dev/null -X POST $API/inventory/receipts -H "$json" -H "$auth" \
    -d "{\"items\":[{\"productId\":\"$1\",\"quantity\":$2}]}"
}
onhand() { curl -s "$API/inventory/stock?search=$1" -H "$auth" | jq -r '.content[0].onHand'; }

SODA=$(mkprod "Soda" "SODA-$S" 1200 2000 0)
BREAD=$(mkprod "Bread" "BREAD-$S" 2000 3000 18)
if [ -z "$SODA" ] || [ -z "$BREAD" ]; then echo "STOP: could not create test products."; exit 1; fi
receive "$SODA" 10
receive "$BREAD" 5
echo "Setup done: soda stock $(onhand SODA-$S), bread stock $(onhand BREAD-$S)"

echo "--- 1: sale of 2 soda + 1 bread (18% tax) paid in cash (expect subtotal 7000, tax 540, total 7540, balanceDue 0)"
SALE1=$(curl -s -X POST $API/sales -H "$json" -H "$auth" \
  -d "{\"items\":[{\"productId\":\"$SODA\",\"quantity\":2},{\"productId\":\"$BREAD\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":7540}]}")
echo "$SALE1" | jq '{receiptNumber, status, subtotal, taxTotal, total, amountPaid, balanceDue, lines: (.items | length)}'
SALE1_ID=$(echo "$SALE1" | jq -r '.id // empty')
if [ -z "$SALE1_ID" ]; then echo "STOP: the first sale failed."; echo "$SALE1"; exit 1; fi

echo "--- 2: stock was deducted (expect soda 8, bread 4)"
echo "soda $(onhand SODA-$S), bread $(onhand BREAD-$S)"

echo "--- 3: price snapshot survives a price change (expect unitPrice 1000 after the price becomes 1200)"
SNAP=$(mkprod "Snapshot Item" "SNAP-$S" 600 1000 0)
receive "$SNAP" 3
SNAP_SALE=$(curl -s -X POST $API/sales -H "$json" -H "$auth" \
  -d "{\"items\":[{\"productId\":\"$SNAP\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":1000}]}")
SNAP_SALE_ID=$(echo "$SNAP_SALE" | jq -r '.id // empty')
curl -s -o /dev/null -X PUT $API/products/$SNAP -H "$json" -H "$auth" \
  -d "{\"name\":\"Snapshot Item\",\"sku\":\"SNAP-$S\",\"costPrice\":600,\"sellingPrice\":1200}"
curl -s $API/sales/$SNAP_SALE_ID -H "$auth" | jq '.items[0] | {unitPrice, unitCost}'

echo "--- 4: payment rules (expect 400 for overpaying, 400 for an unpaid balance with no customer)"
code -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$SODA\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":9999}]}"
code -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$SODA\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":500}]}"

echo "--- 5: not enough stock changes nothing (expect two 409 messages, then soda 8 and bread 4 unchanged)"
curl -s -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$SODA\",\"quantity\":100}],\"payments\":[]}" | jq -r '.message'
curl -s -X POST $API/sales -H "$json" -H "$auth" -d "{\"items\":[{\"productId\":\"$BREAD\",\"quantity\":1},{\"productId\":\"$SODA\",\"quantity\":100}],\"payments\":[]}" | jq -r '.message'
echo "soda $(onhand SODA-$S), bread $(onhand BREAD-$S)"

echo "--- 6: credit sale to a customer (expect total 2000, amountPaid 500, balanceDue 1500, customerName Credit Customer, soda 7)"
CUST_ID=$(psqlv "insert into customers (business_id, name, phone) values ('$BID', 'Credit Customer', '0700000000') returning id;")
curl -s -X POST $API/sales -H "$json" -H "$auth" \
  -d "{\"customerId\":\"$CUST_ID\",\"items\":[{\"productId\":\"$SODA\",\"quantity\":1}],\"payments\":[{\"method\":\"mobile_money\",\"amount\":500,\"reference\":\"MM-$S\"}]}" \
  | jq '{total, amountPaid, balanceDue, customerName}'
echo "soda $(onhand SODA-$S)"

echo "--- 7: a retry with the same key returns the same sale (expect same id true, soda 6 deducted once)"
KEY="idem-$S"
BODY="{\"items\":[{\"productId\":\"$SODA\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":2000}]}"
I1=$(curl -s -X POST $API/sales -H "$json" -H "$auth" -H "Idempotency-Key: $KEY" -d "$BODY")
I2=$(curl -s -X POST $API/sales -H "$json" -H "$auth" -H "Idempotency-Key: $KEY" -d "$BODY")
echo "same id: $( [ "$(echo "$I1" | jq -r .id)" = "$(echo "$I2" | jq -r .id)" ] && echo true || echo false ), receipt $(echo "$I2" | jq -r .receiptNumber)"
echo "soda $(onhand SODA-$S)"

echo "--- 8: void the first sale (expect status voided, then soda 8 and bread 5)"
curl -s -X POST $API/sales/$SALE1_ID/void -H "$json" -H "$auth" -d '{"reason":"Customer returned the goods"}' | jq '{status, voidReason}'
echo "soda $(onhand SODA-$S), bread $(onhand BREAD-$S)"

echo "--- 9: void it again (expect 409)"
code -X POST $API/sales/$SALE1_ID/void -H "$json" -H "$auth" -d '{"reason":"Again"}'

echo "--- 10: staff can sell, and cost stays hidden (expect soldBy Other Owner, unitCost null, soda 7)"
STAFF=$(login "{\"email\":\"other@example.com\",\"password\":\"StrongPass123\",\"businessId\":\"$BID\"}")
STOKEN=$(echo "$STAFF" | jq -r '.accessToken // empty')
sauth="Authorization: Bearer $STOKEN"
if [ -z "$STOKEN" ]; then
  echo "skipped: staff sign-in failed (run scripts/test-catalog.sh first)"
else
  curl -s -X POST $API/sales -H "$json" -H "$sauth" \
    -d "{\"items\":[{\"productId\":\"$SODA\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":2000}]}" \
    | jq '{receiptNumber, soldBy, unitCost: .items[0].unitCost}'
  echo "soda $(onhand SODA-$S)"

  echo "--- 11: staff see only their own sales (expect [\"Other Owner\"]), the owner sees everyone's"
  curl -s "$API/sales?size=100" -H "$sauth" | jq -c '[.content[].soldBy] | unique'
  curl -s "$API/sales?size=100" -H "$auth" | jq -c '[.content[].soldBy] | unique'

  echo "--- 12: staff cannot void (expect 403) or open the owner's sale (expect 404)"
  code -X POST $API/sales/$SALE1_ID/void -H "$json" -H "$sauth" -d '{"reason":"Nope"}'
  code $API/sales/$SALE1_ID -H "$sauth"
fi

echo "--- 13: printable receipt"
curl -s $API/sales/$SALE1_ID/receipt -H "$auth"

echo "--- 14: filters (expect totalElements 1 or more for today's voided sales, then 400 for a bad status)"
TODAY=$(date +%F)
curl -s "$API/sales?from=$TODAY&to=$TODAY&status=voided" -H "$auth" | jq '.totalElements'
code "$API/sales?status=bogus" -H "$auth"

echo "--- 15: 12 simultaneous sales of the last 5 units (expect 5 x 201 and 7 x 409)"
LAST=$(mkprod "Last Units" "LAST-$S" 300 500 0)
receive "$LAST" 5
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/sales -H "$json" -H "$auth" \
    -d "{\"items\":[{\"productId\":\"$LAST\",\"quantity\":1}],\"payments\":[{\"method\":\"cash\",\"amount\":500}]}" &
done | sort | uniq -c
wait
echo "stock now: $(onhand LAST-$S)"

echo "--- 16: stock level equals the ledger (expect level 0 and ledger_sum 0)"
psqlq "select sl.quantity as level, (select coalesce(sum(m.quantity_change), 0) from stock_movements m where m.product_id = sl.product_id) as ledger_sum from stock_levels sl where sl.product_id = '$LAST';"

echo "--- 17: receipt numbers have no gaps (expect sales equal to highest_number)"
psqlq "select count(*) as sales, max(substr(receipt_number, 3)::int) as highest_number from sales where business_id = '$BID';"
