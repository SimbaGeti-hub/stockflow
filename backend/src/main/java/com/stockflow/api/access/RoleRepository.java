package com.stockflow.api.access;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoleRepository extends JpaRepository<Role, Short> {

    Optional<Role> findByRoleKey(String roleKey);

    @Query(value = """
            select p.key from role_permissions rp
            join permissions p on p.id = rp.permission_id
            where rp.role_id = :roleId
            order by p.key
            """, nativeQuery = true)
    List<String> findPermissionKeysByRoleId(@Param("roleId") Short roleId);
}
