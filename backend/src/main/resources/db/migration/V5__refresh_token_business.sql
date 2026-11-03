ALTER TABLE refresh_tokens
    ADD COLUMN business_id uuid NOT NULL REFERENCES businesses (id);

CREATE INDEX idx_refresh_tokens_business ON refresh_tokens (business_id);
