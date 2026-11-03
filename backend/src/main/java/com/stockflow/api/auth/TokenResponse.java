package com.stockflow.api.auth;

import java.util.UUID;

public record TokenResponse(
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        String refreshToken,
        UUID businessId,
        String role) {
}
