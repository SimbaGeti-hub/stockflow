package com.stockflow.api.inventory;

import java.math.BigDecimal;
import java.util.UUID;

public record StockChangeResponse(
        UUID productId,
        String sku,
        BigDecimal quantityChange,
        BigDecimal balanceAfter) {
}
