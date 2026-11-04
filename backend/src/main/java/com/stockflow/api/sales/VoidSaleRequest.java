package com.stockflow.api.sales;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VoidSaleRequest(
        @NotBlank(message = "A reason is required.")
        @Size(max = 255, message = "Reason must be 255 characters or fewer.")
        String reason) {
}
