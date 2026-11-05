package com.stockflow.api.auth;

import com.stockflow.api.common.UnauthorizedException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    public record MeResponse(
            String userId,
            String businessId,
            String role,
            List<String> permissions,
            String fullName,
            String email,
            String businessName,
            String currencyCode) {
    }

    private final JdbcClient jdbc;

    public MeController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/v1/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        UUID businessId = UUID.fromString(jwt.getClaimAsString("bid"));

        // The token alone is not enough: the account and its membership must still be active.
        return jdbc.sql("""
                        select u.full_name, u.email, b.name as business_name, b.currency_code
                        from users u
                        join business_memberships m on m.user_id = u.id
                        join businesses b on b.id = m.business_id
                        where u.id = :u and b.id = :b and u.is_active = true and m.is_active = true
                        """)
                .param("u", userId)
                .param("b", businessId)
                .query((rs, rowNum) -> new MeResponse(
                        userId.toString(),
                        businessId.toString(),
                        jwt.getClaimAsString("role"),
                        jwt.getClaimAsStringList("permissions"),
                        rs.getString("full_name"),
                        rs.getString("email"),
                        rs.getString("business_name"),
                        rs.getString("currency_code")))
                .optional()
                .orElseThrow(() -> new UnauthorizedException("Your account is no longer available."));
    }
}
