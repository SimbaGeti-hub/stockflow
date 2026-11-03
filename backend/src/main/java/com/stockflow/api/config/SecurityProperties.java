package com.stockflow.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(
        String jwtSecret,
        int accessTokenMinutes,
        int refreshTokenDays) {
}
