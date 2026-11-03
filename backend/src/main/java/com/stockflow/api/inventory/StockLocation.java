package com.stockflow.api.inventory;

import com.stockflow.api.business.Business;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_locations")
public class StockLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "is_default", nullable = false)
    private boolean defaultLocation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StockLocation() {
    }

    public StockLocation(Business business, String name, boolean defaultLocation) {
        this.business = business;
        this.name = name;
        this.defaultLocation = defaultLocation;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public boolean isDefaultLocation() {
        return defaultLocation;
    }
}
