package com.stockflow.api.sales;

import com.stockflow.api.common.PageResponse;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sales")
public class SalesController {

    private static final String READ_SALES = "hasAnyAuthority('sales:read_all', 'sales:read_own')";

    private final SalesService salesService;

    public SalesController(SalesService salesService) {
        this.salesService = salesService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('sales:create')")
    public SaleResponse create(
            @Valid @RequestBody CreateSaleRequest request,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
        return salesService.create(request, idempotencyKey);
    }

    @GetMapping
    @PreAuthorize(READ_SALES)
    public PageResponse<SaleSummaryResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return salesService.list(from, to, status, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ_SALES)
    public SaleResponse get(@PathVariable UUID id) {
        return salesService.get(id);
    }

    @GetMapping(value = "/{id}/receipt", produces = "text/plain;charset=UTF-8")
    @PreAuthorize(READ_SALES)
    public String receipt(@PathVariable UUID id) {
        return salesService.receiptText(id);
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("hasAuthority('sales:void')")
    public SaleResponse voidSale(@PathVariable UUID id, @Valid @RequestBody VoidSaleRequest request) {
        return salesService.voidSale(id, request);
    }
}
