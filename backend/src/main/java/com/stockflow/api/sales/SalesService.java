package com.stockflow.api.sales;

import com.stockflow.api.catalog.Product;
import com.stockflow.api.catalog.ProductRepository;
import com.stockflow.api.common.BadRequestException;
import com.stockflow.api.common.ConflictException;
import com.stockflow.api.common.CurrentUser;
import com.stockflow.api.common.NotFoundException;
import com.stockflow.api.common.PageResponse;
import com.stockflow.api.inventory.StockLedger;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalesService {

    /** Default until a per-business time zone setting exists. */
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Africa/Kampala");
    private static final DateTimeFormatter RECEIPT_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final Set<String> SALE_STATUSES = Set.of("draft", "completed", "voided", "refunded");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int MAX_PAGE_SIZE = 100;

    private final JdbcClient jdbc;
    private final StockLedger ledger;
    private final ProductRepository productRepository;

    public SalesService(JdbcClient jdbc, StockLedger ledger, ProductRepository productRepository) {
        this.jdbc = jdbc;
        this.ledger = ledger;
        this.productRepository = productRepository;
    }

    private record PricedLine(Product product, BigDecimal quantity, BigDecimal unitPrice, BigDecimal unitCost,
                              BigDecimal taxRate, BigDecimal subtotal, BigDecimal taxAmount, BigDecimal lineTotal) {
    }

    private record Header(UUID id, String receiptNumber, String status, UUID customerId, String customerName,
                          BigDecimal subtotal, BigDecimal taxTotal, BigDecimal total, BigDecimal amountPaid,
                          OffsetDateTime soldAt, OffsetDateTime voidedAt, String voidReason, String soldByName) {
    }

    private record VoidLine(UUID productId, BigDecimal quantity, BigDecimal unitCost) {
    }

    private record BusinessInfo(String name, String address, String phone, String footer) {
    }

    @Transactional
    public SaleResponse create(CreateSaleRequest request, String idempotencyKey) {
        UUID businessId = CurrentUser.businessId();
        UUID userId = CurrentUser.userId();
        String key = blankToNull(idempotencyKey);

        if (key != null && key.length() > 100) {
            throw new BadRequestException("The Idempotency-Key header must be 100 characters or fewer.");
        }

        // A retry with the same key gets the original sale back instead of a duplicate.
        if (key != null) {
            Optional<UUID> existing = jdbc.sql(
                            "select id from sales where business_id = :b and idempotency_key = :k")
                    .param("b", businessId)
                    .param("k", key)
                    .query(UUID.class)
                    .optional();
            if (existing.isPresent()) {
                return load(existing.get())
                        .orElseThrow(() -> new ConflictException("This request key was already used."));
            }
        }

        UUID customerId = request.customerId();
        if (customerId != null) {
            requireCustomer(businessId, customerId);
        }

        // Lock products in a fixed order so two sales can never deadlock each other.
        List<CreateSaleRequest.SaleLine> lines = new ArrayList<>(request.items());
        lines.sort(Comparator.comparing(CreateSaleRequest.SaleLine::productId));

        Map<UUID, Product> products = new HashMap<>();
        for (CreateSaleRequest.SaleLine line : lines) {
            products.computeIfAbsent(line.productId(), id -> requireActiveProduct(businessId, id));
        }

        // Price every line from the product as it is right now. These values are the snapshot.
        List<PricedLine> priced = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        for (CreateSaleRequest.SaleLine line : lines) {
            Product product = products.get(line.productId());
            BigDecimal lineSubtotal = product.getSellingPrice()
                    .multiply(line.quantity())
                    .setScale(4, RoundingMode.HALF_UP);
            BigDecimal tax = lineSubtotal.multiply(product.getTaxRate())
                    .divide(HUNDRED, 4, RoundingMode.HALF_UP);
            priced.add(new PricedLine(product, line.quantity(), product.getSellingPrice(),
                    product.getCostPrice(), product.getTaxRate(), lineSubtotal, tax, lineSubtotal.add(tax)));
            subtotal = subtotal.add(lineSubtotal);
            taxTotal = taxTotal.add(tax);
        }
        BigDecimal total = subtotal.add(taxTotal);

        List<CreateSaleRequest.PaymentLine> payments =
                request.payments() == null ? List.of() : request.payments();
        BigDecimal paid = BigDecimal.ZERO;
        for (CreateSaleRequest.PaymentLine payment : payments) {
            paid = paid.add(payment.amount());
        }
        if (paid.compareTo(total) > 0) {
            throw new BadRequestException(
                    "Payments are more than the sale total. Record only the amount for this sale and give back the change.");
        }
        if (paid.compareTo(total) < 0 && customerId == null) {
            throw new BadRequestException("A customer is required when the sale is not fully paid.");
        }

        UUID saleId = UUID.randomUUID();
        UUID locationId = ledger.defaultLocationId(businessId);

        // Take the stock. If any line is short, the exception rolls back everything.
        for (PricedLine line : priced) {
            try {
                ledger.post(businessId, line.product().getId(), locationId, "sale",
                        line.quantity().negate(), line.unitCost(), "sale", saleId, null, userId);
            } catch (ConflictException e) {
                throw new ConflictException(line.product().getName() + ": " + e.getMessage());
            }
        }

        // Gap-free receipt number. Taken last so the counter row is locked for the shortest time,
        // and rolled back together with the sale if anything fails.
        long number = jdbc.sql("""
                        insert into document_sequences (business_id, name, next_value)
                        values (:b, 'receipt', 2)
                        on conflict (business_id, name)
                        do update set next_value = document_sequences.next_value + 1
                        returning next_value - 1
                        """)
                .param("b", businessId)
                .query(Long.class)
                .single();
        String receiptNumber = String.format("R-%06d", number);

        jdbc.sql("""
                        insert into sales (id, business_id, receipt_number, customer_id, subtotal,
                                           discount_total, tax_total, total, amount_paid, notes,
                                           idempotency_key, sold_by)
                        values (:id, :b, :rn, :c, :sub, 0, :tax, :total, :paid, :notes, :key, :user)
                        """)
                .param("id", saleId)
                .param("b", businessId)
                .param("rn", receiptNumber)
                .param("c", customerId)
                .param("sub", subtotal)
                .param("tax", taxTotal)
                .param("total", total)
                .param("paid", paid)
                .param("notes", blankToNull(request.notes()))
                .param("key", key)
                .param("user", userId)
                .update();

        for (PricedLine line : priced) {
            jdbc.sql("""
                            insert into sale_items (sale_id, product_id, product_name, sku, quantity,
                                                    unit_price, unit_cost, tax_rate, tax_amount, line_total)
                            values (:s, :p, :name, :sku, :q, :price, :cost, :rate, :tax, :line)
                            """)
                    .param("s", saleId)
                    .param("p", line.product().getId())
                    .param("name", line.product().getName())
                    .param("sku", line.product().getSku())
                    .param("q", line.quantity())
                    .param("price", line.unitPrice())
                    .param("cost", line.unitCost())
                    .param("rate", line.taxRate())
                    .param("tax", line.taxAmount())
                    .param("line", line.lineTotal())
                    .update();
        }

        for (CreateSaleRequest.PaymentLine payment : payments) {
            jdbc.sql("""
                            insert into payments (business_id, sale_id, method, amount, reference, received_by)
                            values (:b, :s, cast(:method as payment_method), :amount, :ref, :user)
                            """)
                    .param("b", businessId)
                    .param("s", saleId)
                    .param("method", payment.method())
                    .param("amount", payment.amount())
                    .param("ref", blankToNull(payment.reference()))
                    .param("user", userId)
                    .update();
        }

        return load(saleId).orElseThrow(() -> new IllegalStateException("The sale was saved but could not be read."));
    }

    @Transactional(readOnly = true)
    public SaleResponse get(UUID saleId) {
        return load(saleId).orElseThrow(() -> new NotFoundException("Sale not found."));
    }

    @Transactional(readOnly = true)
    public PageResponse<SaleSummaryResponse> list(LocalDate fromDate, LocalDate toDate, String status,
                                                  int page, int size) {
        UUID businessId = CurrentUser.businessId();
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        StringBuilder where = new StringBuilder(" where s.business_id = :b");
        Map<String, Object> params = new HashMap<>();
        params.put("b", businessId);

        // Staff can only see the sales they recorded themselves.
        if (!CurrentUser.hasAuthority("sales:read_all")) {
            where.append(" and s.sold_by = :me");
            params.put("me", CurrentUser.userId());
        }
        if (fromDate != null) {
            where.append(" and s.sold_at >= :fromTs");
            params.put("fromTs", OffsetDateTime.ofInstant(
                    fromDate.atStartOfDay(BUSINESS_ZONE).toInstant(), ZoneOffset.UTC));
        }
        if (toDate != null) {
            where.append(" and s.sold_at < :toTs");
            params.put("toTs", OffsetDateTime.ofInstant(
                    toDate.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant(), ZoneOffset.UTC));
        }
        if (status != null && !status.isBlank()) {
            if (!SALE_STATUSES.contains(status)) {
                throw new BadRequestException("Status must be draft, completed, voided, or refunded.");
            }
            where.append(" and s.status = cast(:status as sale_status)");
            params.put("status", status);
        }

        long total = jdbc.sql("select count(*) from sales s" + where)
                .params(params)
                .query(Long.class)
                .single();

        List<SaleSummaryResponse> rows = jdbc.sql("""
                        select s.id, s.receipt_number, s.status, s.total, s.amount_paid, s.sold_at,
                               c.name as customer_name, u.full_name as sold_by_name
                        from sales s
                        left join customers c on c.id = s.customer_id
                        left join users u on u.id = s.sold_by
                        """ + where + " order by s.sold_at desc, s.id desc limit :limit offset :offset")
                .params(params)
                .param("limit", safeSize)
                .param("offset", (long) safePage * safeSize)
                .query((rs, rowNum) -> new SaleSummaryResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("receipt_number"),
                        rs.getString("status"),
                        rs.getBigDecimal("total"),
                        rs.getBigDecimal("amount_paid"),
                        rs.getString("customer_name"),
                        rs.getString("sold_by_name"),
                        rs.getObject("sold_at", OffsetDateTime.class).toInstant()))
                .list();

        int totalPages = (int) Math.ceil((double) total / safeSize);
        return new PageResponse<>(rows, safePage, safeSize, total, totalPages);
    }

    @Transactional
    public SaleResponse voidSale(UUID saleId, VoidSaleRequest request) {
        UUID businessId = CurrentUser.businessId();
        UUID userId = CurrentUser.userId();

        // Lock the sale row so two people cannot void the same sale at the same time.
        String status = jdbc.sql("select status from sales where id = :id and business_id = :b for update")
                .param("id", saleId)
                .param("b", businessId)
                .query(String.class)
                .optional()
                .orElseThrow(() -> new NotFoundException("Sale not found."));

        if (!"completed".equals(status)) {
            throw new ConflictException("Only completed sales can be voided. This sale is " + status + ".");
        }

        List<VoidLine> items = jdbc.sql("""
                        select product_id, quantity, unit_cost from sale_items
                        where sale_id = :id order by product_id
                        """)
                .param("id", saleId)
                .query((rs, rowNum) -> new VoidLine(
                        rs.getObject("product_id", UUID.class),
                        rs.getBigDecimal("quantity"),
                        rs.getBigDecimal("unit_cost")))
                .list();

        // Put the stock back through the same ledger, as new entries. Nothing is edited.
        UUID locationId = ledger.defaultLocationId(businessId);
        String reason = request.reason().trim();
        for (VoidLine item : items) {
            ledger.post(businessId, item.productId(), locationId, "sale_void",
                    item.quantity(), item.unitCost(), "sale", saleId, reason, userId);
        }

        jdbc.sql("""
                        update sales
                        set status = 'voided', voided_by = :u, voided_at = now(), void_reason = :r
                        where id = :id
                        """)
                .param("u", userId)
                .param("r", reason)
                .param("id", saleId)
                .update();

        return load(saleId).orElseThrow(() -> new NotFoundException("Sale not found."));
    }

    @Transactional(readOnly = true)
    public String receiptText(UUID saleId) {
        SaleResponse sale = get(saleId);
        BusinessInfo business = jdbc.sql(
                        "select name, address, phone, receipt_footer from businesses where id = :b")
                .param("b", CurrentUser.businessId())
                .query((rs, rowNum) -> new BusinessInfo(
                        rs.getString("name"),
                        rs.getString("address"),
                        rs.getString("phone"),
                        rs.getString("receipt_footer")))
                .single();

        String line = "--------------------------------\n";
        StringBuilder out = new StringBuilder();
        out.append(business.name()).append('\n');
        if (business.address() != null) {
            out.append(business.address()).append('\n');
        }
        if (business.phone() != null) {
            out.append("Tel: ").append(business.phone()).append('\n');
        }
        out.append(line);
        out.append("Receipt: ").append(sale.receiptNumber()).append('\n');
        out.append("Date:    ").append(RECEIPT_DATE.format(sale.soldAt().atZone(BUSINESS_ZONE))).append('\n');
        out.append("Served by: ").append(sale.soldBy()).append('\n');
        if (sale.customerName() != null) {
            out.append("Customer: ").append(sale.customerName()).append('\n');
        }
        if ("voided".equals(sale.status())) {
            out.append("*** VOIDED ***\n");
        }
        out.append(line);
        for (SaleResponse.Item item : sale.items()) {
            out.append(item.productName()).append('\n');
            out.append("  ").append(money(item.quantity())).append(" x ").append(money(item.unitPrice()))
                    .append(" = ").append(money(item.unitPrice().multiply(item.quantity()))).append('\n');
        }
        out.append(line);
        out.append("Subtotal: ").append(money(sale.subtotal())).append('\n');
        out.append("Tax:      ").append(money(sale.taxTotal())).append('\n');
        out.append("TOTAL:    ").append(money(sale.total())).append('\n');
        for (SaleResponse.Payment payment : sale.payments()) {
            out.append("Paid (").append(payment.method()).append("): ").append(money(payment.amount())).append('\n');
        }
        if (sale.balanceDue().signum() > 0) {
            out.append("Balance due: ").append(money(sale.balanceDue())).append('\n');
        }
        if (business.footer() != null) {
            out.append(line).append(business.footer()).append('\n');
        }
        return out.toString();
    }

    private Optional<SaleResponse> load(UUID saleId) {
        UUID businessId = CurrentUser.businessId();
        boolean includeCost = CurrentUser.hasAuthority("products:write");

        StringBuilder sql = new StringBuilder("""
                select s.id, s.receipt_number, s.status, s.customer_id, c.name as customer_name,
                       s.subtotal, s.tax_total, s.total, s.amount_paid, s.sold_at, s.voided_at,
                       s.void_reason, u.full_name as sold_by_name
                from sales s
                left join customers c on c.id = s.customer_id
                left join users u on u.id = s.sold_by
                where s.id = :id and s.business_id = :b""");
        Map<String, Object> params = new HashMap<>();
        params.put("id", saleId);
        params.put("b", businessId);

        // Staff can only open the sales they recorded themselves.
        if (!CurrentUser.hasAuthority("sales:read_all")) {
            sql.append(" and s.sold_by = :me");
            params.put("me", CurrentUser.userId());
        }

        Optional<Header> header = jdbc.sql(sql.toString())
                .params(params)
                .query((rs, rowNum) -> new Header(
                        rs.getObject("id", UUID.class),
                        rs.getString("receipt_number"),
                        rs.getString("status"),
                        rs.getObject("customer_id", UUID.class),
                        rs.getString("customer_name"),
                        rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("tax_total"),
                        rs.getBigDecimal("total"),
                        rs.getBigDecimal("amount_paid"),
                        rs.getObject("sold_at", OffsetDateTime.class),
                        rs.getObject("voided_at", OffsetDateTime.class),
                        rs.getString("void_reason"),
                        rs.getString("sold_by_name")))
                .optional();
        if (header.isEmpty()) {
            return Optional.empty();
        }
        Header h = header.get();

        List<SaleResponse.Item> items = jdbc.sql("""
                        select product_id, product_name, sku, quantity, unit_price, unit_cost,
                               tax_rate, tax_amount, line_total
                        from sale_items where sale_id = :id order by product_name, sku
                        """)
                .param("id", saleId)
                .query((rs, rowNum) -> new SaleResponse.Item(
                        rs.getObject("product_id", UUID.class),
                        rs.getString("product_name"),
                        rs.getString("sku"),
                        rs.getBigDecimal("quantity"),
                        rs.getBigDecimal("unit_price"),
                        includeCost ? rs.getBigDecimal("unit_cost") : null,
                        rs.getBigDecimal("tax_rate"),
                        rs.getBigDecimal("tax_amount"),
                        rs.getBigDecimal("line_total")))
                .list();

        List<SaleResponse.Payment> payments = jdbc.sql("""
                        select method, amount, reference, paid_at
                        from payments where sale_id = :id order by paid_at, id
                        """)
                .param("id", saleId)
                .query((rs, rowNum) -> new SaleResponse.Payment(
                        rs.getString("method"),
                        rs.getBigDecimal("amount"),
                        rs.getString("reference"),
                        rs.getObject("paid_at", OffsetDateTime.class).toInstant()))
                .list();

        return Optional.of(new SaleResponse(
                h.id(), h.receiptNumber(), h.status(), h.customerId(), h.customerName(),
                h.subtotal(), h.taxTotal(), h.total(), h.amountPaid(), h.total().subtract(h.amountPaid()),
                h.soldByName(), toInstant(h.soldAt()), toInstant(h.voidedAt()), h.voidReason(),
                items, payments));
    }

    private Product requireActiveProduct(UUID businessId, UUID productId) {
        Product product = productRepository.findByIdAndBusinessId(productId, businessId)
                .orElseThrow(() -> new NotFoundException("Product not found."));
        if (!product.isActive()) {
            throw new ConflictException(product.getName() + " is archived and cannot be sold.");
        }
        return product;
    }

    private void requireCustomer(UUID businessId, UUID customerId) {
        Long count = jdbc.sql("select count(*) from customers where id = :c and business_id = :b and is_active = true")
                .param("c", customerId)
                .param("b", businessId)
                .query(Long.class)
                .single();
        if (count == 0) {
            throw new NotFoundException("Customer not found.");
        }
    }

    private static Instant toInstant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String money(BigDecimal value) {
        BigDecimal stripped = value.stripTrailingZeros();
        if (stripped.scale() < 0) {
            stripped = stripped.setScale(0);
        }
        return stripped.toPlainString();
    }
}
