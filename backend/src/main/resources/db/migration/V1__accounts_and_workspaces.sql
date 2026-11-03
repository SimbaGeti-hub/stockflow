CREATE TYPE theme_preference AS ENUM ('light', 'dark', 'system');
CREATE TYPE token_type AS ENUM ('email_verification', 'password_reset');

CREATE TABLE businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(200) NOT NULL,
    email varchar(255),
    phone varchar(50),
    address text,
    logo_url text,
    currency_code char(3) NOT NULL DEFAULT 'UGX',
    default_tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (default_tax_rate >= 0),
    receipt_footer text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    full_name varchar(200) NOT NULL,
    phone varchar(50),
    avatar_url text,
    theme theme_preference NOT NULL DEFAULT 'system',
    email_verified_at timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE roles (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(30) NOT NULL UNIQUE,
    name varchar(60) NOT NULL
);

CREATE TABLE permissions (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(60) NOT NULL UNIQUE,
    description varchar(255)
);

CREATE TABLE role_permissions (
    role_id smallint NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id smallint NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE business_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    user_id uuid NOT NULL REFERENCES users (id),
    role_id smallint NOT NULL REFERENCES roles (id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, user_id)
);
CREATE INDEX idx_memberships_user ON business_memberships (user_id);

CREATE TABLE invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses (id),
    email varchar(255) NOT NULL,
    role_id smallint NOT NULL REFERENCES roles (id),
    token_hash varchar(255) NOT NULL UNIQUE,
    invited_by uuid NOT NULL REFERENCES users (id),
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_business ON invitations (business_id);

CREATE TABLE user_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type token_type NOT NULL,
    token_hash varchar(255) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_tokens_user ON user_tokens (user_id);

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash varchar(255) NOT NULL UNIQUE,
    family_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    user_agent varchar(255),
    ip_address varchar(45),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
