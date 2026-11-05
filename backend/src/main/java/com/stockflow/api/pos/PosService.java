package com.stockflow.api.pos;

import com.stockflow.api.common.CurrentUser;
import com.stockflow.api.inventory.StockLedger;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A read model for the point-of-sale screen: price, tax, and stock in one lookup. */
@Service
public class PosService {

    private static final int MAX_RESULTS = 50;

    private final JdbcClient jdbc;
    private final StockLedger ledger;

    public PosService(JdbcClient jdbc, StockLedger ledger) {
        this.jdbc = jdbc;
        this.ledger = ledger;
    }

    @Transactional(readOnly = true)
    public List<PosProductResponse> search(String search, int limit) {
        UUID businessId = CurrentUser.businessId();
        UUID locationId = ledger.defaultLocationId(businessId);

        StringBuilder where = new StringBuilder(" where p.business_id = :b and p.is_active = true");
        Map<String, Object> params = new HashMap<>();
        params.put("b", businessId);
        params.put("loc", locationId);

        // In-stock items come first.
        String order = " order by (coalesce(sl.quantity, 0) > 0) desc, p.name, p.id";

        if (search != null && !search.isBlank()) {
            String term = search.trim().toLowerCase(Locale.ROOT);
            where.append(" and (lower(p.name) like :q escape '\\'")
                    .append(" or lower(p.sku) like :q escape '\\'")
                    .append(" or lower(p.barcode) like :q escape '\\')");
            params.put("q", "%" + escapeLike(term) + "%");
            params.put("exact", term);

            // An exact barcode or SKU match goes to the top, which is what a scanner needs.
            order = " order by (coalesce(lower(p.barcode) = :exact, false) or lower(p.sku) = :exact) desc,"
                    + " (coalesce(sl.quantity, 0) > 0) desc, p.name, p.id";
        }

        return jdbc.sql("select p.id, p.name, p.sku, p.barcode, p.selling_price, p.tax_rate,"
                        + " coalesce(sl.quantity, 0) as on_hand"
                        + " from products p"
                        + " left join stock_levels sl on sl.product_id = p.id and sl.location_id = :loc"
                        + where + order + " limit :limit")
                .params(params)
                .param("limit", Math.min(Math.max(limit, 1), MAX_RESULTS))
                .query((rs, rowNum) -> new PosProductResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("sku"),
                        rs.getString("barcode"),
                        rs.getBigDecimal("selling_price"),
                        rs.getBigDecimal("tax_rate"),
                        rs.getBigDecimal("on_hand")))
                .list();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
