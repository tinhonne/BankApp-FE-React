# Product Documentation

## Status and evidence policy

This document describes behavior verified in the current Spring Boot source code. It is not a roadmap.

Evidence labels:

- **VERIFIED**: implemented in source code.
- **UNVERIFIED**: cannot be established from source, depends on runtime/framework behavior, or conflicts with another repository document.

`README.md` and `project-spec.md` were inspected but are not treated as authoritative when they conflict with implementation. Database-only fields are omitted unless needed to explain exposed behavior.

## Product overview

The application provides APIs for:

- user creation and user listing;
- username/password authentication and JWT introspection;
- customer creation, retrieval, update, soft deletion, listing, and filtering;
- account creation, retrieval, listing, and listing active accounts for a customer;
- transfers between active accounts;
- paginated transaction history for an account.

There are no implemented reporting, export, account approval, account update, or account deletion APIs.

## Actors and authorization

### Anonymous caller

The security configuration permits anonymous access to:

- create a user;
- request a token;
- introspect a token;
- submit a transfer.

The user-creation request accepts `EMPLOYEE`, `MANAGER`, and `ADMIN`. Consequently, anonymous callers can currently request any of those roles. Whether this is approved product policy is **UNVERIFIED**.

Transfers are currently public and are not tied to an authenticated principal. Whether this is approved product policy is **UNVERIFIED**.

### Authenticated user

Any valid JWT can access customer and account APIs and transaction history. No customer/account ownership checks or `EMPLOYEE`/`MANAGER` distinctions are implemented.

### Administrator

Only a token with authority `SCOPE_ADMIN` can list users. JWTs place the user's role name in the `scope` claim.

## Core concepts

### User

A user has an exposed identifier, username, name, and role. Passwords are BCrypt encoded before persistence and are never exposed by response DTOs.

Roles exposed by the API are:

- `EMPLOYEE`
- `MANAGER`
- `ADMIN`

Usernames must be unique. JWT authentication uses the username as the subject and produces a token valid for one hour.

### Customer

A customer exposes:

- identifier;
- name;
- birthday;
- address;
- identity number;
- optional mobile number;
- customer type;
- integer status;
- creation and update timestamps.

Customer types are exactly:

- `INDIVIDUAL`
- `CORPORATE`

An identity number must be unique when creating a customer. Identity numbers cannot be changed through the update API because the update request has no `identityNo` field.

Deletion is a soft deletion that sets customer status to `0`. Deletion is rejected when the customer has an account whose status is exactly `1`.

The complete semantic dictionary for customer status values is **UNVERIFIED**. Request validation requires a status value but does not restrict the integer range.

### Account

An account exposes:

- identifier;
- customer identifier and customer name;
- 13-digit account number;
- decimal balance;
- integer status;
- creation and update timestamps.

Account creation requires an existing customer and a globally unique account number. The initial balance must be zero or positive. Newly created accounts are assigned status `3` by the service.

The meaning of status `3` is **UNVERIFIED**. Repository documentation suggests pending approval, but no implemented enum or status transition defines it. Status `1` is operationally treated as active by transfer, active-account listing, and customer deletion rules.

No account approval or status-change endpoint is implemented. Therefore, an account created through the current API cannot be activated through an exposed API.

Balances are persisted with decimal precision 19 and scale 2. Currency is **UNVERIFIED**.

### Transaction

A transaction exposes:

- identifier;
- transaction date/time;
- source account number;
- destination account number;
- decimal amount;
- status;
- optional content;
- optional error reason.

Transaction statuses exposed as enum strings are:

- `SUCCESS`
- `INSUFFICIENT_BALANCE`
- `SYSTEM_ERROR`

`SYSTEM_ERROR` exists in the enum, but no service path explicitly creates such a transaction.

## Customer lifecycle

### Creation

Creation verifies DTO constraints and identity-number uniqueness. No minimum age, future-birthday, or customer-type-specific validation is implemented.

### Retrieval and listing

Customers can be retrieved by numeric identifier. The general list is paginated and sorted by customer name ascending.

Filtered listing supports optional:

- case-insensitive name substring;
- case-insensitive identity-number substring;
- case-insensitive mobile substring;
- exact customer type;
- exact integer status.

Filters are combined with logical AND and results are sorted by customer name ascending.

### Update

Update replaces the request-exposed values. Name, birthday, address, customer type, and status are required; mobile is optional/nullable. Identity number is not updateable.

### Soft deletion

Deletion sets status to `0`; it does not remove the record. It is blocked only by accounts whose status is exactly `1`.

## Account lifecycle

### Creation

Creation requires:

- an existing customer;
- a unique account number containing exactly 13 digits;
- a balance greater than or equal to zero.

The service assigns account status `3`.

### Retrieval and listing

Accounts can be retrieved by numeric identifier or exact account number. General account results are paginated and ordered by customer name ascending.

The active-account endpoint uses a customer identifier despite the path variable being named `id`. It returns only accounts with status `1`, ordered by account number ascending. A nonexistent customer is expected to produce an empty page based on repository behavior, but this is **UNVERIFIED** without an integration test.

## Transfer lifecycle

A transfer request supplies source account number, destination account number, amount, and optional content.

Verified rules:

1. The account numbers must be nonblank and different.
2. The amount must be at least `1000`.
3. Both accounts must exist.
4. Both accounts must have status `1`.
5. The accounts are pessimistically locked in lexicographic account-number order.
6. If the source has sufficient funds, the debit, credit, and transaction record occur in one database transaction.
7. A successful transfer has status `SUCCESS`.
8. Insufficient funds do not produce an API error. A transaction is saved and returned with status `INSUFFICIENT_BALANCE` and `errorReason` equal to `Insufficient balance`.

No maximum amount, currency, transfer fee, ownership authorization, idempotency key, or explicit limit on fractional digits is implemented. Persistence behavior for values with more than two decimal places is **UNVERIFIED**.

The error message for code `6006` says the minimum is `0.01`, while validation and service logic enforce `1000`. The implemented threshold is `1000`; the message is contradictory.

## Transaction history

History includes transactions in which the requested account is either source or destination.

Verified behavior:

- the account must exist;
- `fromDate` and `toDate` are optional;
- both bounds are inclusive;
- when both are supplied, `fromDate` cannot be after `toDate`;
- page numbering is zero-based;
- page defaults to `0` and size defaults to `10`;
- page must be at least `0`;
- size must be from `1` through `100`;
- ordering is transaction date descending, then transaction identifier descending.

## Authentication

Authentication compares the submitted password with the BCrypt-encoded stored password. A successful response contains a signed HS512 JWT and `authenticated: true`.

Verified JWT claims and behavior:

- subject: username;
- scope: role enum name;
- expiration: one hour after issue;
- signature algorithm: HS512.

The signing key and any bootstrap credentials are intentionally not documented.

Token introspection returns `valid: true` for a token that passes verification and has not expired, otherwise `valid: false` for token-verification failures handled by the service. Null or malformed request behavior is **UNVERIFIED**.

## Date, time, enum, and numeric behavior

- Birthdays use `LocalDate` and are represented as date-only values, expected in ISO `yyyy-MM-dd` form.
- Audit and transaction timestamps use `LocalDateTime` without an offset or timezone.
- Transaction-history query dates explicitly use ISO date-time parsing.
- Exact emitted fractional-second precision and server timezone are **UNVERIFIED**.
- Enums are exposed by their exact uppercase Java enum names.
- Monetary values use `BigDecimal` JSON numbers.
- Preservation of trailing zeros in JSON is **UNVERIFIED**.

## Known contradictions

| Topic | Implemented source | Conflicting documentation |
|---|---|---|
| Security | JWT filter chain and endpoint authorization exist | README says endpoints are not protected |
| Passwords | Passwords are BCrypt encoded | README says passwords are not encoded |
| Pagination | Customer, account, active-account, and history pagination exists | README says pagination is absent |
| Customer paths | Update/delete use `/customers/{id}` | README lists paths without `{id}` |
| Account mutation | No account PUT or DELETE mappings | README lists account PUT and DELETE |
| Customer type | `INDIVIDUAL`, `CORPORATE` | README uses `PERSONAL`, `BUSINESS` |
| Error codes | Integer codes such as `2001` and `6001` | Project specification proposes string codes |
| Transfer minimum | Request and service enforce `1000` | Specification says greater than zero; error text says `0.01` |
| Planned APIs | No approval, report, export, or specified search APIs | Project specification lists them |

## Known limitations and unverified policy

- Public role-selecting user creation.
- Public unauthenticated transfers.
- No ownership-based authorization.
- No implemented account activation workflow.
- No complete customer/account integer-status dictionaries.
- No declared currency or timezone.
- No idempotency mechanism for transfers.
- No account approval, account update, account deletion, reports, or exports.
- Exact Spring Security 401/403 response schema is **UNVERIFIED**.
- Exact malformed-input response behavior is **UNVERIFIED**.

## Source traceability

Primary implementation sources:

- `src/main/java/com/example/demo/controller/`
- `src/main/java/com/example/demo/dto/`
- `src/main/java/com/example/demo/service/`
- `src/main/java/com/example/demo/repository/`
- `src/main/java/com/example/demo/specification/`
- `src/main/java/com/example/demo/config/SecurityConfig.java`
- `src/main/java/com/example/demo/exception/`
- relevant enums and entities under `src/main/java/com/example/demo/entity/`

Repository documents inspected for contradictions:

- `README.md`
- `project-spec.md`
