package com.stockflow.api.inventory;

import com.stockflow.api.catalog.Product;
import com.stockflow.api.catalog.ProductRepository;
import com.stockflow.api.common.ConflictException;
import com.stockflow.api.common.CurrentUser;
import com.stockflow.api.common.NotFoundException;
import com.stockflow.api.common.PageResponse;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String COST_PERMISSION = "inventory:adjust";

    private final JdbcClient jdbc;
    private final StockLedger ledger;
    private final ProductRepository productRepository;

    public InventoryService(JdbcClient jdbc, StockLedger ledger, ProductRepository productRepository) {
        this.jdbc = jdbc;
        this.ledger = ledger;
        this.productRepository = productRepository;
    }

    @Transactional
    public ReceiptResponse receive(ReceiveStockRequest request) {
        UUID businessId = CurrentUser.businessId();
        UUID userId = CurrentUser.userId();
        UUID locationId = ledger.defaultLocationId(businessId);
        UUID receiptId = UUID.randomUUID();

        // Lock products in a fixed order so two receipts can never deadlock each other.
        List<ReceiveStockRequest.ReceiveItem> items = new ArrayList<>(request.items());
        items.sort(Comparator.comparing(ReceiveStockRequest.ReceiveItem::productId));

        // Check every product first, so a bad line fails before anything is written.
        Map<UUID, Product> products = new HashMap<>();
        for (ReceiveStockRequest.ReceiveItem item : items) {
            products.computeIfAbsent(item.productId(), id -> requireActiveProduct(businessId, id));
        }

        jdbc.sql("""
                insert into goods_receipts (id, business_id, received_by, notes)
                values (:id, :b, :u, :notes)
                """)
                .param("id", receiptId)
                .param("b", businessId)
                .param("u", userId)
                .param("notes", blankToNull(request.notes()))
                .update();

        List<StockChangeResponse> lines = new ArrayList<>();
        for (ReceiveStockRequest.ReceiveItem item : items) {
            Product product = products.get(item.productId());
            BigDecimal unitCost = item.unitCost() != null ? item.unitCost() : product.getCostPrice();

            jdbc.sql("""
                    insert into goods_receipt_items (goods_receipt_id, product_id, quantity, unit_cost)
                    values (:r, :p, :q, :c)
                    """)
                    .param("r", receiptId)
                    .param("p", product.getId())
                    .param("q", item.quantity())
                    .param("c", unitCost)
                    .update();

            BigDecimal balance = ledger.post(businessId, product.getId(), locationId, "purchase_receipt",
                    item.quantity(), unitCost, "goods_receipt", receiptId, null, userId);

            lines.add(new StockChangeResponse(product.getId(), product.getSku(), item.quantity(), balance));
        }
        return new ReceiptResponse(receiptId, lines);
    }

    @Transactional
    public StockChangeResponse adjust(AdjustStockRequest request) {
        UUID businessId = CurrentUser.businessId();
        Product product = requireActiveProduct(businessId, request.productId());
        UUID locationId = ledger.defaultLocationId(businessId);

        BigDecimal balance = ledger.post(businessId, product.getId(), locationId, "adjustment",
                request.quantityChange(), product.getCostPrice(), "manual", null,
                request.reason().trim(), CurrentUser.userId());

        return new StockChangeResponse(product.getId(), product.getSku(), request.quantityChange(), balance);
    }

    @Transactional(readOnly = true)
    public PageResponse<StockItemResponse> stockLevels(String search, boolean lowStockOnly, int page, int size) {
        UUID businessId = CurrentUser.businessId();
        UUID locationId = ledger.defaultLocationId(businessId);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        String from = " from products p"
                + " left join stock_levels sl on sl.product_id = p.id and sl.location_id = :loc";
        StringBuilder where = new StringBuilder(" where p.business_id = :b and p.is_active = true");
        Map<String, Object> params = new HashMap<>();
        params.put("b", businessId);
        params.put("loc", locationId);

        if (search != null && !search.isBlank()) {
            String pattern = "%" + escapeLike(search.trim().toLowerCase(Locale.ROOT)) + "%";
            where.append(" and (lower(p.name) like :q escape '\\'")
                    .append(" or lower(p.sku) like :q escape '\\'")
                    .append(" or lower(p.barcode) like :q escape '\\')");
            params.put("q", pattern);
        }
        if (lowStockOnly) {
            where.append(" and coalesce(sl.quantity, 0) <= p.reorder_threshold");
        }

        long total = jdbc.sql("select count(*)" + from + where)
                .params(params)
                .query(Long.class)
                .single();

        List<StockItemResponse> rows = jdbc.sql(
                        "select p.id, p.name, p.sku, p.reorder_threshold, coalesce(sl.quantity, 0) as on_hand"
                                + from + where + " order by p.name, p.id limit :limit offset :offset")
                .params(params)
                .param("limit", safeSize)
                .param("offset", (long) safePage * safeSize)
                .query((rs, rowNum) -> {
                    BigDecimal onHand = rs.getBigDecimal("on_hand");
                    BigDecimal threshold = rs.getBigDecimal("reorder_threshold");
                    return new StockItemResponse(
                            rs.getObject("id", UUID.class),
                            rs.getString("name"),
                            rs.getString("sku"),
                            onHand,
                            threshold,
                            StockItemResponse.statusFor(onHand, threshold));
                })
                .list();

        return toPage(rows, total, safePage, safeSize);
    }

    @Transactional(readOnly = true)
    public PageResponse<StockMovementResponse> movements(UUID productId, int page, int size) {
        UUID businessId = CurrentUser.businessId();
        productRepository.findByIdAndBusinessId(productId, businessId)
                .orElseThrow(() -> new NotFoundException("Product not found."));

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        boolean includeCost = CurrentUser.hasAuthority(COST_PERMISSION);

        long total = jdbc.sql("select count(*) from stock_movements where business_id = :b and product_id = :p")
                .param("b", businessId)
                .param("p", productId)
                .query(Long.class)
                .single();

        List<StockMovementResponse> rows = jdbc.sql("""
                        select m.id, m.movement_type, m.quantity_change, m.balance_after, m.unit_cost,
                               m.reference_type, m.reference_id, m.reason, m.created_at,
                               u.full_name as created_by_name
                        from stock_movements m
                        left join users u on u.id = m.created_by
                        where m.business_id = :b and m.product_id = :p
                        order by m.created_at desc, m.id desc
                        limit :limit offset :offset
                        """)
                .param("b", businessId)
                .param("p", productId)
                .param("limit", safeSize)
                .param("offset", (long) safePage * safeSize)
                .query((rs, rowNum) -> new StockMovementResponse(
                        rs.getLong("id"),
                        rs.getString("movement_type"),
                        rs.getBigDecimal("quantity_change"),
                        rs.getBigDecimal("balance_after"),
                        includeCost ? rs.getBigDecimal("unit_cost") : null,
                        rs.getString("reference_type"),
                        rs.getObject("reference_id", UUID.class),
                        rs.getString("reason"),
                        rs.getString("created_by_name"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()))
                .list();

        return toPage(rows, total, safePage, safeSize);
    }

    private Product requireActiveProduct(UUID businessId, UUID productId) {
        Product product = productRepository.findByIdAndBusinessId(productId, businessId)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        if (!product.isActive()) {
            throw new ConflictException("This product is archived. Restore it before changing its stock.");
        }
        return product;
    }

    private static <T> PageResponse<T> toPage(List<T> rows, long total, int page, int size) {
        int totalPages = (int) Math.ceil((double) total / size);
        return new PageResponse<>(rows, page, size, total, totalPages);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
