package com.stockflow.api.catalog;

import com.stockflow.api.common.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('products:write')")
    public ProductResponse create(@Valid @RequestBody ProductRequest request) {
        return productService.create(request);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('products:read')")
    public PageResponse<ProductResponse> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String direction) {
        return productService.search(search, categoryId, active, page, size, sortBy, direction);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('products:read')")
    public ProductResponse get(@PathVariable UUID id) {
        return productService.get(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('products:write')")
    public ProductResponse update(@PathVariable UUID id, @Valid @RequestBody ProductRequest request) {
        return productService.update(id, request);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAuthority('products:write')")
    public ProductResponse archive(@PathVariable UUID id) {
        return productService.archive(id);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('products:write')")
    public ProductResponse restore(@PathVariable UUID id) {
        return productService.restore(id);
    }
}
