package com.stockflow.api.pos;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductResponse(
        UUID id,
        String name,
        String sku,
        String barcode,
        BigDecimal sellingPrice,
        BigDecimal taxRate,
        BigDecimal onHand) {
}
