package com.stockflow.api.pos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CancelSaleRequest(
        @Size(max = 255, message = "Reason must be 255 characters or fewer.")
        String reason,

        @NotEmpty(message = "There is nothing to cancel.")
        @Size(max = 100, message = "A sale can have at most 100 lines.")
        @Valid
        List<Line> items) {

    public record Line(
            @NotNull(message = "Product is required.")
            UUID productId,

            @NotNull(message = "Quantity is required.")
            @DecimalMin(value = "0", inclusive = false, message = "Quantity must be more than zero.")
            @Digits(integer = 11, fraction = 3, message = "Quantity has too many digits.")
            BigDecimal quantity) {
    }
}
