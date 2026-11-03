package com.stockflow.api.common;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads the signed-in user and workspace from the verified access token. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static UUID userId() {
        return UUID.fromString(jwt().getSubject());
    }

    public static UUID businessId() {
        return UUID.fromString(jwt().getClaimAsString("bid"));
    }

    public static boolean hasAuthority(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(granted -> granted.getAuthority().equals(authority));
    }

    private static Jwt jwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt;
        }
        throw new UnauthorizedException("You are not signed in.");
    }
}
