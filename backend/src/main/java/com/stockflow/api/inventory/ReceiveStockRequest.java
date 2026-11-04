package com.stockflow.api.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReceiveStockRequest(
        @Size(max = 1000, message = "Notes must be 1000 characters or fewer.")
        String notes,

        @NotEmpty(message = "Add at least one item.")
        @Size(max = 100, message = "A receipt can have at most 100 items.")
        @Valid
        List<ReceiveItem> items) {

    public record ReceiveItem(
            @NotNull(message = "Product is required.")
            UUID productId,

            @NotNull(message = "Quantity is required.")
            @DecimalMin(value = "0", inclusive = false, message = "Quantity must be more than zero.")
            @Digits(integer = 11, fraction = 3, message = "Quantity has too many digits.")
            BigDecimal quantity,

            @DecimalMin(value = "0", message = "Unit cost cannot be negative.")
            @Digits(integer = 15, fraction = 4, message = "Unit cost has too many digits.")
            BigDecimal unitCost) {
    }
}
