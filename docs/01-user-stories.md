# User stories: vertical slice

Format: As a [role], I want [action], so that [benefit].

Scope: the thin end-to-end path for Phase 1. Register, create a product, receive stock, sell it, and trace the stock change.

## US-1 Register a business

As a business owner, I want to sign up and create my business workspace, so that I can start managing my stock and sales.

Acceptance criteria:
- Given I enter my name, email, password, and business name, when I submit, then my account and workspace are created and I become the Owner.
- Given the email is already registered, when I submit, then I see a clear error and no account is created.
- Given the password is shorter than 8 characters, when I submit, then I see a validation message.
- The password is stored hashed, never as plain text.

## US-2 Sign in

As a user, I want to sign in with my email and password, so that I can reach my business data.

Acceptance criteria:
- Given valid credentials, when I sign in, then I reach my workspace dashboard.
- Given wrong credentials, when I sign in, then I see a generic error that does not reveal which part was wrong.
- I can only see data that belongs to my own business workspace.

## US-3 Create a product

As an owner, I want to add a product with its name, SKU, cost price, selling price, and low-stock threshold, so that I can sell and track it.

Acceptance criteria:
- Given valid details, when I save, then the product appears in my product list with zero stock.
- Given a SKU that already exists in my business, when I save, then I see a duplicate error.
- Prices must be zero or more, and are stored with exact decimal precision.
- The product list supports search by name or SKU.

## US-4 Receive stock

As an owner, I want to record stock received for a product, so that my stock count is correct.

Acceptance criteria:
- Given a product and a quantity above zero, when I save, then the product's stock increases by that quantity.
- A stock movement entry is recorded with the type "received", the quantity, the resulting balance, the user, and the time.
- Stock movement entries cannot be edited or deleted.

## US-5 Record a sale

As a cashier, I want to record a sale with one or more products, so that the customer gets a receipt and stock goes down.

Acceptance criteria:
- Given products and quantities, when I complete the sale, then the total is calculated automatically.
- Each sale line stores the unit price and unit cost at the time of sale.
- Given a quantity above the available stock, when I complete the sale, then it is blocked with a clear message.
- Given two sales for the last unit at the same moment, then only one succeeds.
- I can record a payment method (cash, card, or mobile money) with the sale.
- A receipt is shown after the sale.

## US-6 Trace stock changes

As an owner, I want to see the history of stock changes for a product, so that I can understand where every unit went.

Acceptance criteria:
- Given a product, when I open its history, then I see every movement with type, quantity, balance after, user, time, and the sale or receipt that caused it.
- The current stock equals the sum of all its movements.
