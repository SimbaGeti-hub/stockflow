package com.stockflow.api.auth;

import com.stockflow.api.access.BusinessMembership;
import com.stockflow.api.access.BusinessMembershipRepository;
import com.stockflow.api.access.Role;
import com.stockflow.api.access.RoleRepository;
import com.stockflow.api.business.Business;
import com.stockflow.api.business.BusinessRepository;
import com.stockflow.api.common.ConflictException;
import com.stockflow.api.common.UnauthorizedException;
import com.stockflow.api.config.SecurityProperties;
import com.stockflow.api.inventory.StockLocation;
import com.stockflow.api.inventory.StockLocationRepository;
import com.stockflow.api.user.User;
import com.stockflow.api.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String OWNER_ROLE_KEY = "owner";
    private static final String DEFAULT_LOCATION_NAME = "Main store";
    private static final String INVALID_LOGIN = "Invalid email or password.";
    private static final String SESSION_EXPIRED = "Your session has expired. Please sign in again.";

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final RoleRepository roleRepository;
    private final BusinessMembershipRepository membershipRepository;
    private final StockLocationRepository stockLocationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SecurityProperties properties;

    /** Used so a login for an unknown email takes as long as one for a real email. */
    private final String dummyPasswordHash;

    public AuthService(UserRepository userRepository,
                       BusinessRepository businessRepository,
                       RoleRepository roleRepository,
                       BusinessMembershipRepository membershipRepository,
                       StockLocationRepository stockLocationRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       SecurityProperties properties) {
        this.userRepository = userRepository;
        this.businessRepository = businessRepository;
        this.roleRepository = roleRepository;
        this.membershipRepository = membershipRepository;
        this.stockLocationRepository = stockLocationRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.properties = properties;
        this.dummyPasswordHash = passwordEncoder.encode("not-a-real-password");
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with this email already exists.");
        }

        Role ownerRole = roleRepository.findByRoleKey(OWNER_ROLE_KEY)
                .orElseThrow(() -> new IllegalStateException(
                        "The owner role is missing. Check the database migrations."));

        Business business = businessRepository.save(
                new Business(request.businessName().trim(), request.currencyCode()));

        User user = userRepository.save(new User(
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim()));

        membershipRepository.save(new BusinessMembership(business, user, ownerRole));
        stockLocationRepository.save(new StockLocation(business, DEFAULT_LOCATION_NAME, true));

        return new RegisterResponse(
                user.getId(),
                business.getId(),
                user.getFullName(),
                user.getEmail(),
                business.getName(),
                business.getCurrencyCode(),
                ownerRole.getRoleKey());
    }

    @Transactional
    public TokenResponse login(LoginRequest request, String userAgent, String ipAddress) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        String hashToCheck = user != null ? user.getPasswordHash() : dummyPasswordHash;
        boolean passwordMatches = passwordEncoder.matches(request.password(), hashToCheck);

        if (user == null || !passwordMatches || !user.isActive()) {
            throw new UnauthorizedException(INVALID_LOGIN);
        }

        BusinessMembership membership = request.businessId() != null
                ? membershipRepository.findActive(user.getId(), request.businessId())
                        .orElseThrow(() -> new UnauthorizedException(INVALID_LOGIN))
                : membershipRepository.findActiveByUserId(user.getId()).stream().findFirst()
                        .orElseThrow(() -> new UnauthorizedException(INVALID_LOGIN));

        user.recordLogin();
        return issueTokens(user, membership, UUID.randomUUID(), userAgent, ipAddress);
    }

    /**
     * Each refresh token works once. If an already-used token is presented again,
     * the whole token family is revoked. noRollbackFor keeps that revocation saved
     * even though we then reject the request.
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public TokenResponse refresh(String rawRefreshToken, String userAgent, String ipAddress) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(TokenUtil.sha256(rawRefreshToken))
                .orElseThrow(() -> new UnauthorizedException(SESSION_EXPIRED));

        Instant now = Instant.now();

        if (stored.isRevoked()) {
            refreshTokenRepository.revokeFamily(stored.getFamilyId(), now);
            throw new UnauthorizedException(SESSION_EXPIRED);
        }
        if (stored.getExpiresAt().isBefore(now)) {
            throw new UnauthorizedException(SESSION_EXPIRED);
        }

        User user = userRepository.findById(stored.getUserId())
                .filter(User::isActive)
                .orElseThrow(() -> new UnauthorizedException(SESSION_EXPIRED));

        BusinessMembership membership = membershipRepository
                .findActive(user.getId(), stored.getBusinessId())
                .orElseThrow(() -> new UnauthorizedException(SESSION_EXPIRED));

        stored.revoke(now);
        return issueTokens(user, membership, stored.getFamilyId(), userAgent, ipAddress);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenRepository.findByTokenHash(TokenUtil.sha256(rawRefreshToken))
                .ifPresent(token -> refreshTokenRepository.revokeFamily(token.getFamilyId(), Instant.now()));
    }

    private TokenResponse issueTokens(User user, BusinessMembership membership, UUID familyId,
                                      String userAgent, String ipAddress) {
        Role role = membership.getRole();
        UUID businessId = membership.getBusiness().getId();
        List<String> permissions = roleRepository.findPermissionKeysByRoleId(role.getId());

        String accessToken = jwtService.createAccessToken(
                user.getId(), businessId, role.getRoleKey(), permissions);

        String rawRefreshToken = TokenUtil.newToken();
        refreshTokenRepository.save(new RefreshToken(
                user.getId(),
                businessId,
                TokenUtil.sha256(rawRefreshToken),
                familyId,
                Instant.now().plus(Duration.ofDays(properties.refreshTokenDays())),
                userAgent,
                ipAddress));

        return new TokenResponse(
                accessToken,
                "Bearer",
                properties.accessTokenMinutes() * 60L,
                rawRefreshToken,
                businessId,
                role.getRoleKey());
    }
}
