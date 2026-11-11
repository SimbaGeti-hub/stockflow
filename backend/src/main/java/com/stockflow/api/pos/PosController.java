package com.stockflow.api.pos;

import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/v1/pos")
public class PosController {

    private final PosService posService;
    private final CancellationService cancellationService;

    public PosController(PosService posService, CancellationService cancellationService) {
        this.posService = posService;
        this.cancellationService = cancellationService;
    }

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('sales:create')")
    public List<PosProductResponse> products(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "30") int limit) {
        return posService.search(search, limit);
    }

    @PostMapping("/cancellations")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('sales:create')")
    public void cancel(@Valid @RequestBody CancelSaleRequest request) {
        cancellationService.record(request);
    }
}
