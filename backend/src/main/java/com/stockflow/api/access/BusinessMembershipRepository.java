package com.stockflow.api.access;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessMembershipRepository extends JpaRepository<BusinessMembership, UUID> {

    @Query("""
            select m from BusinessMembership m
            join fetch m.business
            join fetch m.role
            where m.user.id = :userId and m.active = true
            order by m.createdAt
            """)
    List<BusinessMembership> findActiveByUserId(@Param("userId") UUID userId);

    @Query("""
            select m from BusinessMembership m
            join fetch m.business
            join fetch m.role
            where m.user.id = :userId and m.business.id = :businessId and m.active = true
            """)
    Optional<BusinessMembership> findActive(@Param("userId") UUID userId,
                                            @Param("businessId") UUID businessId);
}
