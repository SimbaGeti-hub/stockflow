package com.stockflow.api.pos;

import com.stockflow.api.common.BadRequestException;
import com.stockflow.api.common.CurrentUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records a sale that was started and then cancelled before it was charged.
 * Nothing is sold and no stock moves, but the cancellation is kept for accountability.
 */
@Service
public class CancellationService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int MAX_SUMMARY_LENGTH = 480;

    private final JdbcClient jdbc;

    public CancellationService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private record ProductRow(UUID id, String name, BigDecimal price, BigDecimal taxRate) {
    }

    @Transactional
    public void record(CancelSaleRequest request) {
        UUID businessId = CurrentUser.businessId();
        UUID userId = CurrentUser.userId();

        // Product names and prices come from the database, never from the browser.
        List<UUID> ids = request.items().stream().map(CancelSaleRequest.Line::productId).distinct().toList();
        List<ProductRow> rows = jdbc.sql("""
                        select id, name, selling_price, tax_rate from products
                        where business_id = :b and id in (:ids)
                        """)
                .param("b", businessId)
                .param("ids", ids)
                .query((rs, rowNum) -> new ProductRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getBigDecimal("selling_price"),
                        rs.getBigDecimal("tax_rate")))
                .list();
        Map<UUID, ProductRow> byId = rows.stream().collect(Collectors.toMap(ProductRow::id, row -> row));

        BigDecimal total = BigDecimal.ZERO;
        List<String> parts = new ArrayList<>();
        for (CancelSaleRequest.Line line : request.items()) {
            ProductRow product = byId.get(line.productId());
            if (product == null) {
                continue;
            }
            BigDecimal subtotal = product.price().multiply(line.quantity()).setScale(4, RoundingMode.HALF_UP);
            BigDecimal tax = subtotal.multiply(product.taxRate()).divide(HUNDRED, 4, RoundingMode.HALF_UP);
            total = total.add(subtotal).add(tax);
            parts.add(line.quantity().stripTrailingZeros().toPlainString() + " x " + product.name());
        }
        if (parts.isEmpty()) {
            throw new BadRequestException("Nothing to cancel.");
        }

        String summary = String.join(", ", parts);
        if (summary.length() > MAX_SUMMARY_LENGTH) {
            summary = summary.substring(0, MAX_SUMMARY_LENGTH) + "...";
        }
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();

        jdbc.sql("""
                        insert into audit_logs (business_id, user_id, action, entity_type, details)
                        values (:b, :u, 'sale.cancelled', 'sale_draft',
                                jsonb_build_object(
                                    'reason', cast(:reason as text),
                                    'lines', cast(:lines as integer),
                                    'estimatedTotal', cast(:total as numeric),
                                    'summary', cast(:summary as text)))
                        """)
                .param("b", businessId)
                .param("u", userId)
                .param("reason", reason)
                .param("lines", parts.size())
                .param("total", total)
                .param("summary", summary)
                .update();
    }
}
