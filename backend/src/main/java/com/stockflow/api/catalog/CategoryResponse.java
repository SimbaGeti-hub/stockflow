package com.stockflow.api.catalog;

import java.util.UUID;

public record CategoryResponse(UUID id, String name) {

    public static CategoryResponse from(Category category) {
        return new CategoryResponse(category.getId(), category.getName());
    }
}
