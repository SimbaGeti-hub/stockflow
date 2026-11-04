package com.stockflow.api.sales;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
        UUID id,
        String receiptNumber,
        String status,
        UUID customerId,
        String customerName,
        BigDecimal subtotal,
        BigDecimal taxTotal,
        BigDecimal total,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        String soldBy,
        Instant soldAt,
        Instant voidedAt,
        String voidReason,
        List<Item> items,
        List<Payment> payments) {

    public record Item(
            UUID productId,
            String productName,
            String sku,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal unitCost,
            BigDecimal taxRate,
            BigDecimal taxAmount,
            BigDecimal lineTotal) {
    }

    public record Payment(
            String method,
            BigDecimal amount,
            String reference,
            Instant paidAt) {
    }
}
