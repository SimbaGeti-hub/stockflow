package com.stockflow.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Your name is required.")
        @Size(max = 200, message = "Your name must be 200 characters or fewer.")
        String fullName,

        @NotBlank(message = "Email is required.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 255, message = "Email must be 255 characters or fewer.")
        String email,

        @NotBlank(message = "Password is required.")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.")
        String password,

        @NotBlank(message = "Business name is required.")
        @Size(max = 200, message = "Business name must be 200 characters or fewer.")
        String businessName,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter code such as UGX.")
        String currencyCode) {
}
