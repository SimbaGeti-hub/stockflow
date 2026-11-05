package com.stockflow.api.pos;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pos")
public class PosController {

    private final PosService posService;

    public PosController(PosService posService) {
        this.posService = posService;
    }

    @GetMapping("/products")
    @PreAuthorize("hasAuthority('sales:create')")
    public List<PosProductResponse> products(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "30") int limit) {
        return posService.search(search, limit);
    }
}
