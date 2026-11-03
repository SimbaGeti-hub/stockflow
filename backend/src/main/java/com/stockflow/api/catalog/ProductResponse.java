package com.stockflow.api.catalog;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String name,
        String sku,
        String barcode,
        String description,
        UUID categoryId,
        String categoryName,
        BigDecimal costPrice,
        BigDecimal sellingPrice,
        BigDecimal taxRate,
        BigDecimal reorderThreshold,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {

    /** Cost price is only included for users allowed to manage products. */
    public static ProductResponse from(Product product, boolean includeCost) {
        Category category = product.getCategory();
        return new ProductResponse(
                product.getId(),
                product.getName(),
                product.getSku(),
                product.getBarcode(),
                product.getDescription(),
                category != null ? category.getId() : null,
                category != null ? category.getName() : null,
                includeCost ? product.getCostPrice() : null,
                product.getSellingPrice(),
                product.getTaxRate(),
                product.getReorderThreshold(),
                product.isActive(),
                product.getCreatedAt(),
                product.getUpdatedAt());
    }
}
