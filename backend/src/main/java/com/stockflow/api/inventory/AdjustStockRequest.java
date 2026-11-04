package com.stockflow.api.inventory;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

public record AdjustStockRequest(
        @NotNull(message = "Product is required.")
        UUID productId,

        @NotNull(message = "Quantity change is required.")
        @Digits(integer = 11, fraction = 3, message = "Quantity change has too many digits.")
        BigDecimal quantityChange,

        @NotBlank(message = "A reason is required.")
        @Size(max = 255, message = "Reason must be 255 characters or fewer.")
        String reason) {

    @AssertTrue(message = "Quantity change cannot be zero.")
    public boolean isQuantityChangeNonZero() {
        return quantityChange == null || quantityChange.signum() != 0;
    }
}
