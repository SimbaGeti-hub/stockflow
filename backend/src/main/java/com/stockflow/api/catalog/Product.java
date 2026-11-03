package com.stockflow.api.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 64)
    private String sku;

    @Column(length = 64)
    private String barcode;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "cost_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal costPrice;

    @Column(name = "selling_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal sellingPrice;

    @Column(name = "tax_rate", nullable = false, precision = 7, scale = 4)
    private BigDecimal taxRate;

    @Column(name = "reorder_threshold", nullable = false, precision = 14, scale = 3)
    private BigDecimal reorderThreshold;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Product() {
    }

    public Product(UUID businessId, UUID createdBy, Category category, String name, String sku,
                   String barcode, String description, BigDecimal costPrice, BigDecimal sellingPrice,
                   BigDecimal taxRate, BigDecimal reorderThreshold) {
        this.businessId = businessId;
        this.createdBy = createdBy;
        update(category, name, sku, barcode, description, costPrice, sellingPrice, taxRate, reorderThreshold);
    }

    public void update(Category category, String name, String sku, String barcode, String description,
                       BigDecimal costPrice, BigDecimal sellingPrice, BigDecimal taxRate,
                       BigDecimal reorderThreshold) {
        this.category = category;
        this.name = name;
        this.sku = sku;
        this.barcode = barcode;
        this.description = description;
        this.costPrice = costPrice;
        this.sellingPrice = sellingPrice;
        this.taxRate = taxRate;
        this.reorderThreshold = reorderThreshold;
    }

    public void archive() {
        this.active = false;
    }

    public void restore() {
        this.active = true;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Category getCategory() {
        return category;
    }

    public String getName() {
        return name;
    }

    public String getSku() {
        return sku;
    }

    public String getBarcode() {
        return barcode;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public BigDecimal getSellingPrice() {
        return sellingPrice;
    }

    public BigDecimal getTaxRate() {
        return taxRate;
    }

    public BigDecimal getReorderThreshold() {
        return reorderThreshold;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
