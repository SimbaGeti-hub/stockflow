package com.stockflow.api.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateSaleRequest(
        UUID customerId,

        @Size(max = 1000, message = "Notes must be 1000 characters or fewer.")
        String notes,

        @NotEmpty(message = "Add at least one item.")
        @Size(max = 100, message = "A sale can have at most 100 lines.")
        @Valid
        List<SaleLine> items,

        @Size(max = 10, message = "A sale can have at most 10 payments.")
        @Valid
        List<PaymentLine> payments) {

    public record SaleLine(
            @NotNull(message = "Product is required.")
            UUID productId,

            @NotNull(message = "Quantity is required.")
            @DecimalMin(value = "0", inclusive = false, message = "Quantity must be more than zero.")
            @Digits(integer = 11, fraction = 3, message = "Quantity has too many digits.")
            BigDecimal quantity) {
    }

    public record PaymentLine(
            @NotNull(message = "Payment method is required.")
            @Pattern(regexp = "cash|card|mobile_money|bank_transfer|other",
                    message = "Payment method must be cash, card, mobile_money, bank_transfer, or other.")
            String method,

            @NotNull(message = "Payment amount is required.")
            @DecimalMin(value = "0", inclusive = false, message = "Payment amount must be more than zero.")
            @Digits(integer = 15, fraction = 4, message = "Payment amount has too many digits.")
            BigDecimal amount,

            @Size(max = 100, message = "Payment reference must be 100 characters or fewer.")
            String reference) {
    }
}
