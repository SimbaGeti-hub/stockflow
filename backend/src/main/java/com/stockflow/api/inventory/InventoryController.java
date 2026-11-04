package com.stockflow.api.inventory;

import com.stockflow.api.common.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping("/receipts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory:adjust')")
    public ReceiptResponse receive(@Valid @RequestBody ReceiveStockRequest request) {
        return inventoryService.receive(request);
    }

    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory:adjust')")
    public StockChangeResponse adjust(@Valid @RequestBody AdjustStockRequest request) {
        return inventoryService.adjust(request);
    }

    @GetMapping("/stock")
    @PreAuthorize("hasAuthority('inventory:read')")
    public PageResponse<StockItemResponse> stock(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean lowStock,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return inventoryService.stockLevels(search, lowStock, page, size);
    }

    @GetMapping("/movements")
    @PreAuthorize("hasAuthority('inventory:read')")
    public PageResponse<StockMovementResponse> movements(
            @RequestParam UUID productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return inventoryService.movements(productId, page, size);
    }
}
