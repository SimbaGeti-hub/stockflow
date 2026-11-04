package com.stockflow.api.inventory;

import java.util.List;
import java.util.UUID;

public record ReceiptResponse(UUID receiptId, List<StockChangeResponse> lines) {
}
