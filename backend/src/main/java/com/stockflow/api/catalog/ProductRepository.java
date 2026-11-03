package com.stockflow.api.catalog;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    Optional<Product> findByIdAndBusinessId(UUID id, UUID businessId);

    boolean existsByBusinessIdAndSku(UUID businessId, String sku);

    boolean existsByBusinessIdAndSkuAndIdNot(UUID businessId, String sku, UUID id);
}
