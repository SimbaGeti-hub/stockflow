package com.stockflow.api.auth;

import com.stockflow.api.access.BusinessMembership;
import com.stockflow.api.access.BusinessMembershipRepository;
import com.stockflow.api.access.Role;
import com.stockflow.api.access.RoleRepository;
import com.stockflow.api.business.Business;
import com.stockflow.api.business.BusinessRepository;
import com.stockflow.api.common.ConflictException;
import com.stockflow.api.inventory.StockLocation;
import com.stockflow.api.inventory.StockLocationRepository;
import com.stockflow.api.user.User;
import com.stockflow.api.user.UserRepository;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String OWNER_ROLE_KEY = "owner";
    private static final String DEFAULT_LOCATION_NAME = "Main store";

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final RoleRepository roleRepository;
    private final BusinessMembershipRepository membershipRepository;
    private final StockLocationRepository stockLocationRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       BusinessRepository businessRepository,
                       RoleRepository roleRepository,
                       BusinessMembershipRepository membershipRepository,
                       StockLocationRepository stockLocationRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.businessRepository = businessRepository;
        this.roleRepository = roleRepository;
        this.membershipRepository = membershipRepository;
        this.stockLocationRepository = stockLocationRepository;
        this.passwordEncoder = passwordEncoder;
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
}
