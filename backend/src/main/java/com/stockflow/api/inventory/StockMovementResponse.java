package com.stockflow.api.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StockMovementResponse(
        long id,
        String movementType,
        BigDecimal quantityChange,
        BigDecimal balanceAfter,
        BigDecimal unitCost,
        String referenceType,
        UUID referenceId,
        String reason,
        String createdBy,
        Instant createdAt) {
}
