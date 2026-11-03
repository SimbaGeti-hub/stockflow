CREATE TYPE movement_type AS ENUM (
    'opening_balance', 'purchase_receipt', 'sale', 'sale_void', 'sale_refund', 'adjustment'
);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(120) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, name)
);

CREATE TABLE units_of_measure (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(60) NOT NULL,
    abbreviation varchar(15) NOT NULL,
    allows_decimals boolean NOT NULL DEFAULT false,
    UNIQUE (business_id, name)
);

CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    category_id uuid REFERENCES categories (id),
    unit_id uuid REFERENCES units_of_measure (id),
    name varchar(200) NOT NULL,
    sku varchar(64) NOT NULL,
    barcode varchar(64),
    description text,
    image_url text,
    cost_price numeric(19,4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    selling_price numeric(19,4) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
    reorder_threshold numeric(14,3) NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, sku)
);
CREATE INDEX idx_products_barcode ON products (business_id, barcode);
CREATE INDEX idx_products_name ON products (business_id, name);
CREATE INDEX idx_products_category ON products (category_id);

CREATE TABLE stock_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    name varchar(120) NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, name)
);
CREATE UNIQUE INDEX uq_one_default_location ON stock_locations (business_id) WHERE is_default;

CREATE TABLE stock_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    product_id uuid NOT NULL REFERENCES products (id),
    location_id uuid NOT NULL REFERENCES stock_locations (id),
    quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, location_id)
);
CREATE INDEX idx_stock_levels_business ON stock_levels (business_id);

CREATE TABLE stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses (id),
    product_id uuid NOT NULL REFERENCES products (id),
    location_id uuid NOT NULL REFERENCES stock_locations (id),
    movement_type movement_type NOT NULL,
    quantity_change numeric(14,3) NOT NULL CHECK (quantity_change <> 0),
    balance_after numeric(14,3) NOT NULL CHECK (balance_after >= 0),
    unit_cost numeric(19,4),
    reference_type varchar(30),
    reference_id uuid,
    reason varchar(255),
    created_by uuid REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_product ON stock_movements (business_id, product_id, created_at);
CREATE INDEX idx_movements_reference ON stock_movements (reference_type, reference_id);

-- The ledger is append-only: rows can never be changed or removed.
CREATE FUNCTION forbid_ledger_changes() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION forbid_ledger_changes();
