package com.stockflow.api.catalog;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record ProductRequest(
        @NotBlank(message = "Product name is required.")
        @Size(max = 200, message = "Product name must be 200 characters or fewer.")
        String name,

        @NotBlank(message = "SKU is required.")
        @Size(max = 64, message = "SKU must be 64 characters or fewer.")
        String sku,

        @Size(max = 64, message = "Barcode must be 64 characters or fewer.")
        String barcode,

        @Size(max = 2000, message = "Description must be 2000 characters or fewer.")
        String description,

        UUID categoryId,

        @NotNull(message = "Cost price is required.")
        @DecimalMin(value = "0", message = "Cost price cannot be negative.")
        @Digits(integer = 15, fraction = 4, message = "Cost price has too many digits.")
        BigDecimal costPrice,

        @NotNull(message = "Selling price is required.")
        @DecimalMin(value = "0", message = "Selling price cannot be negative.")
        @Digits(integer = 15, fraction = 4, message = "Selling price has too many digits.")
        BigDecimal sellingPrice,

        @DecimalMin(value = "0", message = "Tax rate cannot be negative.")
        @DecimalMax(value = "100", message = "Tax rate cannot be more than 100.")
        @Digits(integer = 3, fraction = 4, message = "Tax rate has too many digits.")
        BigDecimal taxRate,

        @DecimalMin(value = "0", message = "Reorder threshold cannot be negative.")
        @Digits(integer = 11, fraction = 3, message = "Reorder threshold has too many digits.")
        BigDecimal reorderThreshold) {
}
