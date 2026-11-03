package com.stockflow.api.catalog;

import com.stockflow.api.common.ConflictException;
import com.stockflow.api.common.CurrentUser;
import com.stockflow.api.common.NotFoundException;
import com.stockflow.api.common.PageResponse;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductService {

    private static final Set<String> SORTABLE_FIELDS = Set.of("name", "sku", "sellingPrice", "createdAt");
    private static final int MAX_PAGE_SIZE = 100;
    private static final String WRITE_PERMISSION = "products:write";

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public ProductService(ProductRepository productRepository, CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        UUID businessId = CurrentUser.businessId();
        String sku = normalizeSku(request.sku());

        if (productRepository.existsByBusinessIdAndSku(businessId, sku)) {
            throw new ConflictException("A product with this SKU already exists.");
        }

        Product product = new Product(
                businessId,
                CurrentUser.userId(),
                resolveCategory(businessId, request.categoryId()),
                request.name().trim(),
                sku,
                blankToNull(request.barcode()),
                blankToNull(request.description()),
                request.costPrice(),
                request.sellingPrice(),
                zeroIfNull(request.taxRate()),
                zeroIfNull(request.reorderThreshold()));

        return toResponse(productRepository.save(product));
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID id) {
        return toResponse(findOwned(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String search, UUID categoryId, Boolean active,
                                                int page, int size, String sortBy, String direction) {
        UUID businessId = CurrentUser.businessId();

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("businessId"), businessId));

            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + escapeLike(search.trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.<String>get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.<String>get("sku")), pattern, '\\'),
                        cb.like(cb.lower(root.<String>get("barcode")), pattern, '\\')));
            }

            // Load categories in the same query for the list, but not for the count query.
            if (query != null && !Long.class.equals(query.getResultType())
                    && !long.class.equals(query.getResultType())) {
                root.fetch("category", JoinType.LEFT);
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        String sortField = SORTABLE_FIELDS.contains(sortBy) ? sortBy : "name";
        Sort sort = "desc".equalsIgnoreCase(direction)
                ? Sort.by(sortField).descending()
                : Sort.by(sortField).ascending();
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE), sort);

        Page<Product> result = productRepository.findAll(spec, pageable);
        boolean includeCost = CurrentUser.hasAuthority(WRITE_PERMISSION);
        return PageResponse.of(result, product -> ProductResponse.from(product, includeCost));
    }

    @Transactional
    public ProductResponse update(UUID id, ProductRequest request) {
        UUID businessId = CurrentUser.businessId();
        Product product = findOwned(id);
        String sku = normalizeSku(request.sku());

        if (productRepository.existsByBusinessIdAndSkuAndIdNot(businessId, sku, id)) {
            throw new ConflictException("A product with this SKU already exists.");
        }

        product.update(
                resolveCategory(businessId, request.categoryId()),
                request.name().trim(),
                sku,
                blankToNull(request.barcode()),
                blankToNull(request.description()),
                request.costPrice(),
                request.sellingPrice(),
                zeroIfNull(request.taxRate()),
                zeroIfNull(request.reorderThreshold()));

        return toResponse(product);
    }

    @Transactional
    public ProductResponse archive(UUID id) {
        Product product = findOwned(id);
        product.archive();
        return toResponse(product);
    }

    @Transactional
    public ProductResponse restore(UUID id) {
        Product product = findOwned(id);
        product.restore();
        return toResponse(product);
    }

    private Product findOwned(UUID id) {
        return productRepository.findByIdAndBusinessId(id, CurrentUser.businessId())
                .orElseThrow(() -> new NotFoundException("Product not found."));
    }

    private Category resolveCategory(UUID businessId, UUID categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categoryRepository.findByIdAndBusinessId(categoryId, businessId)
                .orElseThrow(() -> new NotFoundException("Category not found."));
    }

    private ProductResponse toResponse(Product product) {
        return ProductResponse.from(product, CurrentUser.hasAuthority(WRITE_PERMISSION));
    }

    private static String normalizeSku(String sku) {
        return sku.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
