package com.stockflow.api.inventory;

import com.stockflow.api.common.ConflictException;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only place that changes stock. Every change locks the stock row, checks the new
 * balance, updates the cached level, and appends a row to the append-only ledger,
 * all inside the caller's transaction.
 */
@Component
public class StockLedger {

    private final JdbcClient jdbc;

    public StockLedger(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID defaultLocationId(UUID businessId) {
        return jdbc.sql("select id from stock_locations where business_id = :b and is_default = true")
                .param("b", businessId)
                .query(UUID.class)
                .optional()
                .orElseThrow(() -> new IllegalStateException("This business has no default stock location."));
    }

    /**
     * Posts one stock movement and returns the new balance.
     * MANDATORY means it can never run without a surrounding transaction, because the
     * row lock only protects us while that transaction is open.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public BigDecimal post(UUID businessId, UUID productId, UUID locationId, String movementType,
                           BigDecimal quantityChange, BigDecimal unitCost, String referenceType,
                           UUID referenceId, String reason, UUID userId) {

        // Make sure the stock row exists, then lock it. Other requests for the same
        // product wait here until this transaction finishes.
        jdbc.sql("""
                insert into stock_levels (business_id, product_id, location_id, quantity)
                values (:b, :p, :l, 0)
                on conflict (product_id, location_id) do nothing
                """)
                .param("b", businessId)
                .param("p", productId)
                .param("l", locationId)
                .update();

        BigDecimal current = jdbc.sql("""
                select quantity from stock_levels
                where product_id = :p and location_id = :l
                for update
                """)
                .param("p", productId)
                .param("l", locationId)
                .query(BigDecimal.class)
                .single();

        BigDecimal updated = current.add(quantityChange);
        if (updated.signum() < 0) {
            throw new ConflictException(
                    "Not enough stock. Available: " + current.stripTrailingZeros().toPlainString());
        }

        jdbc.sql("""
                update stock_levels set quantity = :q, updated_at = now()
                where product_id = :p and location_id = :l
                """)
                .param("q", updated)
                .param("p", productId)
                .param("l", locationId)
                .update();

        jdbc.sql("""
                insert into stock_movements
                    (business_id, product_id, location_id, movement_type, quantity_change,
                     balance_after, unit_cost, reference_type, reference_id, reason, created_by)
                values
                    (:b, :p, :l, cast(:type as movement_type), :change,
                     :after, :cost, :refType, :refId, :reason, :user)
                """)
                .param("b", businessId)
                .param("p", productId)
                .param("l", locationId)
                .param("type", movementType)
                .param("change", quantityChange)
                .param("after", updated)
                .param("cost", unitCost)
                .param("refType", referenceType)
                .param("refId", referenceId)
                .param("reason", reason)
                .param("user", userId)
                .update();

        return updated;
    }
}
