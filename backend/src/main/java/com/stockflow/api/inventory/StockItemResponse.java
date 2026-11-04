package com.stockflow.api.inventory;

import java.math.BigDecimal;
import java.util.UUID;

public record StockItemResponse(
        UUID productId,
        String name,
        String sku,
        BigDecimal onHand,
        BigDecimal reorderThreshold,
        String status) {

    public static String statusFor(BigDecimal onHand, BigDecimal reorderThreshold) {
        if (onHand.signum() <= 0) {
            return "OUT_OF_STOCK";
        }
        if (onHand.compareTo(reorderThreshold) <= 0) {
            return "LOW_STOCK";
        }
        return "IN_STOCK";
    }
}
