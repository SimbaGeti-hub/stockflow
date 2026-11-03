package com.stockflow.api.auth;

import java.util.UUID;

public record RegisterResponse(
        UUID userId,
        UUID businessId,
        String fullName,
        String email,
        String businessName,
        String currencyCode,
        String role) {
}
