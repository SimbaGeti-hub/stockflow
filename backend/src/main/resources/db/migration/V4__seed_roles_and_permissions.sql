INSERT INTO roles (key, name) VALUES
    ('owner', 'Owner'),
    ('administrator', 'Administrator'),
    ('staff', 'Staff');

INSERT INTO permissions (key, description) VALUES
    ('products:read', 'View products'),
    ('products:write', 'Create, edit, and archive products'),
    ('categories:write', 'Manage categories'),
    ('inventory:read', 'View stock levels and movement history'),
    ('inventory:adjust', 'Receive stock and make corrections'),
    ('suppliers:read', 'View suppliers'),
    ('suppliers:write', 'Manage suppliers'),
    ('purchases:read', 'View purchase orders'),
    ('purchases:create', 'Create purchase orders'),
    ('purchases:receive', 'Receive purchased goods'),
    ('customers:read', 'View customers'),
    ('customers:write', 'Create and edit customers'),
    ('sales:create', 'Record sales'),
    ('sales:read_own', 'View sales recorded by the user'),
    ('sales:read_all', 'View all sales'),
    ('sales:void', 'Void sales'),
    ('sales:refund', 'Refund sales'),
    ('reports:view', 'View reports'),
    ('reports:export', 'Export reports'),
    ('audit:view', 'View the audit log'),
    ('users:manage', 'Invite users, change roles, deactivate users'),
    ('settings:manage', 'Manage business settings');

-- Owner: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'owner';

-- Administrator: everything except business settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'administrator' AND p.key <> 'settings:manage';

-- Staff: selling and read access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.key IN ('products:read', 'inventory:read', 'customers:read',
               'customers:write', 'sales:create', 'sales:read_own')
WHERE r.key = 'staff';
