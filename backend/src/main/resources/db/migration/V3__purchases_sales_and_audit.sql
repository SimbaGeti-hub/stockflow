CREATE TYPE purchase_status AS ENUM ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
CREATE TYPE sale_status AS ENUM ('draft', 'completed', 'voided', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'mobile_money', 'bank_transfer', 'other');

CREATE TABLE suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(200) NOT NULL,
    contact_name varchar(200),
    phone varchar(50),
    email varchar(255),
    address text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_business ON suppliers (business_id);

CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    supplier_id uuid NOT NULL REFERENCES suppliers (id),
    po_number varchar(30) NOT NULL,
    status purchase_status NOT NULL DEFAULT 'draft',
    ordered_at timestamptz,
    expected_at date,
    notes text,
    created_by uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, po_number)
);
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);

CREATE TABLE purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products (id),
    quantity_ordered numeric(14,3) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost numeric(19,4) NOT NULL CHECK (unit_cost >= 0)
);
CREATE INDEX idx_poi_order ON purchase_order_items (purchase_order_id);

CREATE TABLE goods_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    purchase_order_id uuid REFERENCES purchase_orders (id),
    received_by uuid NOT NULL REFERENCES users (id),
    received_at timestamptz NOT NULL DEFAULT now(),
    notes text
);
CREATE INDEX idx_receipts_business ON goods_receipts (business_id, received_at);

CREATE TABLE goods_receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id uuid NOT NULL REFERENCES goods_receipts (id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products (id),
    purchase_order_item_id uuid REFERENCES purchase_order_items (id),
    quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
    unit_cost numeric(19,4) NOT NULL CHECK (unit_cost >= 0)
);
CREATE INDEX idx_gri_receipt ON goods_receipt_items (goods_receipt_id);

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(200) NOT NULL,
    phone varchar(50),
    email varchar(255),
    address text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_business ON customers (business_id, name);

CREATE TABLE sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    receipt_number varchar(30) NOT NULL,
    customer_id uuid REFERENCES customers (id),
    status sale_status NOT NULL DEFAULT 'completed',
    subtotal numeric(19,4) NOT NULL CHECK (subtotal >= 0),
    discount_total numeric(19,4) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    tax_total numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
    total numeric(19,4) NOT NULL CHECK (total >= 0),
    amount_paid numeric(19,4) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    notes text,
    idempotency_key varchar(100),
    sold_by uuid NOT NULL REFERENCES users (id),
    sold_at timestamptz NOT NULL DEFAULT now(),
    voided_by uuid REFERENCES users (id),
    voided_at timestamptz,
    void_reason varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, receipt_number),
    UNIQUE (business_id, idempotency_key)
);
CREATE INDEX idx_sales_date ON sales (business_id, sold_at);
CREATE INDEX idx_sales_customer ON sales (customer_id);
CREATE INDEX idx_sales_seller ON sales (sold_by);

CREATE TABLE sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products (id),
    product_name varchar(200) NOT NULL,
    sku varchar(64) NOT NULL,
    quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
    unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
    unit_cost numeric(19,4) NOT NULL CHECK (unit_cost >= 0),
    discount_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
    tax_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    line_total numeric(19,4) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX idx_sale_items_sale ON sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON sale_items (product_id);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    sale_id uuid NOT NULL REFERENCES sales (id),
    method payment_method NOT NULL,
    amount numeric(19,4) NOT NULL CHECK (amount > 0),
    reference varchar(100),
    received_by uuid NOT NULL REFERENCES users (id),
    paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_sale ON payments (sale_id);
CREATE INDEX idx_payments_business ON payments (business_id, paid_at);

CREATE TABLE document_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(30) NOT NULL,
    next_value bigint NOT NULL DEFAULT 1,
    UNIQUE (business_id, name)
);

CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses (id),
    user_id uuid REFERENCES users (id),
    action varchar(60) NOT NULL,
    entity_type varchar(40),
    entity_id uuid,
    details jsonb,
    ip_address varchar(45),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_business_date ON audit_logs (business_id, created_at);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
