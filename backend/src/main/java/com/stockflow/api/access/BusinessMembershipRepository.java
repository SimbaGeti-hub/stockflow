package com.stockflow.api.access;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessMembershipRepository extends JpaRepository<BusinessMembership, UUID> {
}
