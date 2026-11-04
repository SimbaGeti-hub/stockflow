package com.stockflow.api.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SaleSummaryResponse(
        UUID id,
        String receiptNumber,
        String status,
        BigDecimal total,
        BigDecimal amountPaid,
        String customerName,
        String soldBy,
        Instant soldAt) {
}
