package com.stockflow.api.access;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    private Short id;

    @Column(name = "key", nullable = false, length = 30)
    private String roleKey;

    @Column(nullable = false, length = 60)
    private String name;

    protected Role() {
    }

    public Short getId() {
        return id;
    }

    public String getRoleKey() {
        return roleKey;
    }

    public String getName() {
        return name;
    }
}
