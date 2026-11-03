#!/usr/bin/env bash
# Checks the category and product APIs. The backend must be running on port 8081.
API=http://localhost:8081/api/v1
json='Content-Type: application/json'
login() { curl -s -X POST $API/auth/login -H "$json" -d "$1"; }

OWNER=$(login '{"email":"owner@example.com","password":"StrongPass123"}')
TOKEN=$(echo "$OWNER" | jq -r '.accessToken // empty')
BID=$(echo "$OWNER" | jq -r '.businessId // empty')
if [ -z "$TOKEN" ]; then
  echo "STOP: could not sign in. Is the backend running on port 8081?"
  exit 1
fi
auth="Authorization: Bearer $TOKEN"

echo "--- 1: create category (expect Beverages and an id)"
CAT=$(curl -s -X POST $API/categories -H "$json" -H "$auth" -d '{"name":"Beverages"}')
echo "$CAT" | jq .
CAT_ID=$(echo "$CAT" | jq -r .id)

echo "--- 2: duplicate category (expect 409)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/categories -H "$json" -H "$auth" -d '{"name":"beverages"}'

echo "--- 3: create product (expect COKE-500, Beverages, cost 1200, price 2000, active true)"
PROD=$(curl -s -X POST $API/products -H "$json" -H "$auth" -d "{\"name\":\"Coca-Cola 500ml\",\"sku\":\"coke-500\",\"barcode\":\"5449000000996\",\"categoryId\":\"$CAT_ID\",\"costPrice\":1200,\"sellingPrice\":2000,\"reorderThreshold\":24}")
echo "$PROD" | jq '{name, sku, categoryName, costPrice, sellingPrice, active}'
PROD_ID=$(echo "$PROD" | jq -r .id)

echo "--- 4: duplicate SKU in other letter case (expect 409)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/products -H "$json" -H "$auth" -d '{"name":"Other","sku":"Coke-500","costPrice":1,"sellingPrice":2}'

echo "--- 5: bad input (expect field errors for name, costPrice, sellingPrice)"
curl -s -X POST $API/products -H "$json" -H "$auth" -d '{"name":"","sku":"A1","costPrice":-5}' | jq '.fieldErrors'

echo "--- 6: search by name (expect totalElements 1)"
curl -s "$API/products?search=cola&active=true" -H "$auth" | jq '{totalElements, first: .content[0].name}'

echo "--- 7: search with a percent sign (expect 0)"
curl -s "$API/products?search=%25" -H "$auth" | jq '.totalElements'

echo "--- 8: update the price (expect 2200)"
curl -s -X PUT $API/products/$PROD_ID -H "$json" -H "$auth" -d "{\"name\":\"Coca-Cola 500ml\",\"sku\":\"COKE-500\",\"categoryId\":\"$CAT_ID\",\"costPrice\":1200,\"sellingPrice\":2200}" | jq '{sellingPrice}'

echo "--- 9: archive, list active, restore (expect false, 0, true)"
curl -s -X POST $API/products/$PROD_ID/archive -H "$auth" | jq '.active'
curl -s "$API/products?active=true" -H "$auth" | jq '.totalElements'
curl -s -X POST $API/products/$PROD_ID/restore -H "$auth" | jq '.active'

echo "--- 10: invalid id in the path (expect 400)"
curl -s -o /dev/null -w "%{http_code}\n" $API/products/not-a-uuid -H "$auth"

echo "--- 11: second business cannot see the first (expect register 201 or 409, then 0, then 404)"
curl -s -o /dev/null -w "register: %{http_code}\n" -X POST $API/auth/register -H "$json" -d '{"fullName":"Other Owner","email":"other@example.com","password":"StrongPass123","businessName":"Other Shop"}'
OTHER=$(login '{"email":"other@example.com","password":"StrongPass123"}')
OTOKEN=$(echo "$OTHER" | jq -r '.accessToken // empty')
curl -s $API/products -H "Authorization: Bearer $OTOKEN" | jq '.totalElements'
curl -s -o /dev/null -w "%{http_code}\n" $API/products/$PROD_ID -H "Authorization: Bearer $OTOKEN"

echo "--- 12: make that person Staff in the first business, then sign in there (expect role staff)"
docker exec -i stockflow-db psql -U stockflow -d stockflow -c "insert into business_memberships (business_id, user_id, role_id) select b.id, u.id, r.id from businesses b, users u, roles r where b.id = '$BID' and u.email = 'other@example.com' and r.key = 'staff' on conflict (business_id, user_id) do nothing;"
STAFF=$(login "{\"email\":\"other@example.com\",\"password\":\"StrongPass123\",\"businessId\":\"$BID\"}")
STOKEN=$(echo "$STAFF" | jq -r '.accessToken // empty')
echo "$STAFF" | jq '{role}'

echo "--- 13: staff can read, costPrice hidden (expect costPrice null)"
curl -s $API/products/$PROD_ID -H "Authorization: Bearer $STOKEN" | jq '{name, sellingPrice, costPrice}'

echo "--- 14: staff cannot create (expect 403)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/products -H "$json" -H "Authorization: Bearer $STOKEN" -d '{"name":"X","sku":"X1","costPrice":1,"sellingPrice":2}'
