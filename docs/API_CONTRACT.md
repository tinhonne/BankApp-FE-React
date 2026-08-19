# API Contract

## Contract status

This contract documents the current Spring Boot implementation. Fields, endpoints, validation rules, roles, and error codes are included only when verified from source. Items that require runtime confirmation or conflict with repository documentation are marked **UNVERIFIED**.

No base-path prefix is configured. Paths below are relative to the server origin. JSON is used for request and response bodies.

## Authentication and authorization

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Public POST endpoints:

- `/users`
- `/auth/token`
- `/auth/introspect`
- `/transactions/transfer`

`GET /users` requires authority `SCOPE_ADMIN`. All other endpoints require authentication but no specific authority.

The JWT is HS512-signed, has the username as subject, includes the role name in `scope`, and expires one hour after issue.

The exact response bodies for authentication failure (`401`) and access denial (`403`) are **UNVERIFIED** because no custom Spring Security entry point or access-denied handler is configured. They must not be assumed to use the API envelope.

## Common response envelope

Successful controller responses, except HTTP 204 deletion, use:

```json
{
  "code": 1000,
  "message": "Success",
  "result": {}
}
```

| Field | Type | Required | Nullable | Description |
|---|---|---:|---:|---|
| `code` | integer | Yes | No | Application code; `1000` for success |
| `message` | string | Yes | No | `Success` for success |
| `result` | endpoint-specific | Yes on success | Endpoint-dependent | Response payload |

Application errors are constructed as:

```json
{
  "code": 2002,
  "message": "Khach hang khong ton tai"
}
```

The error builder leaves `result` null. Whether Jackson emits `"result": null` or omits it is **UNVERIFIED** and inconsistent with an existing controller-test expectation.

HTTP status and application `code` are separate. Creation endpoints return HTTP 201 while retaining application code `1000`.

## Validation error behavior

Bean-validation failures return HTTP 400 with code `1001`. The message is the first field error's validation message. Field-level error details and all validation failures are not returned.

Malformed JSON, invalid enum strings, invalid path-variable types, missing bodies, and query conversion failures do not have dedicated handlers. Their exact status/body is **UNVERIFIED**; do not rely on the standard envelope for them.

## Serialization conventions

No custom Jackson naming strategy or `@JsonProperty` annotations are present. JSON names are therefore the exact camelCase DTO property names documented here.

- `LocalDate`: date-only ISO form, expected as `yyyy-MM-dd`.
- `LocalDateTime`: ISO local date-time without timezone or UTC offset.
- History query timestamps explicitly use ISO date-time parsing.
- Exact emitted fractional-second precision and runtime timezone are **UNVERIFIED**.
- Enums: exact uppercase enum names.
- `BigDecimal`: JSON number. Trailing-zero preservation is **UNVERIFIED**.
- Monetary database columns use precision 19 and scale 2; incoming values are not consistently limited to two fractional digits.

## Required, optional, and nullable

- **Required** means request validation or Java/controller behavior requires the property.
- **Optional** means the property or query parameter may be omitted.
- **Nullable** means source validation permits a JSON null value.
- Primitive response fields are non-null.
- Response nullability is documented where source behavior establishes it; otherwise it is **UNVERIFIED**.

## Pagination

Paginated responses place this object in `result`:

```json
{
  "content": [],
  "pageNumber": 0,
  "pageSize": 10,
  "totalElements": 0,
  "totalPages": 0,
  "last": true
}
```

| Field | Type | Required | Nullable |
|---|---|---:|---:|
| `content` | array | Yes | No |
| `pageNumber` | integer | Yes | No |
| `pageSize` | integer | Yes | No |
| `totalElements` | integer/int64 | Yes | No |
| `totalPages` | integer | Yes | No |
| `last` | boolean | Yes | No |

Pages are zero-based. Unless an endpoint says otherwise, `page` defaults to `0` and `size` defaults to `10`. Only transaction history explicitly validates page and size; invalid values for other paginated endpoints have **UNVERIFIED** error handling.

## Shared schemas

### `UserResponse`

| Field | Type | Nullable |
|---|---|---:|
| `id` | integer/int64 | UNVERIFIED |
| `username` | string | UNVERIFIED |
| `name` | string | UNVERIFIED |
| `role` | enum string | UNVERIFIED |

Role values: `EMPLOYEE`, `MANAGER`, `ADMIN`.

### `CustomerResponse`

| Field | Type | Nullable |
|---|---|---:|
| `id` | integer/int64 | UNVERIFIED |
| `name` | string | UNVERIFIED |
| `birthday` | string/date | UNVERIFIED |
| `address` | string | UNVERIFIED |
| `identityNo` | string | UNVERIFIED |
| `mobile` | string | Yes |
| `customerType` | enum string | UNVERIFIED |
| `status` | integer | UNVERIFIED |
| `createDatetime` | string/local-date-time | UNVERIFIED |
| `updateDatetime` | string/local-date-time | Yes |

Customer type values: `INDIVIDUAL`, `CORPORATE`.

The complete allowed customer-status values are **UNVERIFIED**.

### `AccountResponse`

| Field | Type | Nullable |
|---|---|---:|
| `id` | integer/int64 | UNVERIFIED |
| `customerId` | integer/int64 | UNVERIFIED |
| `customerName` | string | UNVERIFIED |
| `accountNumber` | string | UNVERIFIED |
| `balance` | number/decimal | UNVERIFIED |
| `status` | integer | UNVERIFIED |
| `createDatetime` | string/local-date-time | UNVERIFIED |
| `updateDatetime` | string/local-date-time | Yes |

Status `1` is treated as active. New accounts are assigned status `3`; its label is **UNVERIFIED**.

### `TransactionResponse`

| Field | Type | Nullable |
|---|---|---:|
| `id` | integer/int64 | UNVERIFIED |
| `transactionDate` | string/local-date-time | UNVERIFIED |
| `fromAccountNumber` | string | UNVERIFIED |
| `toAccountNumber` | string | UNVERIFIED |
| `amount` | number/decimal | UNVERIFIED |
| `status` | enum string | UNVERIFIED |
| `content` | string | Yes |
| `errorReason` | string | Yes |

Status values: `SUCCESS`, `INSUFFICIENT_BALANCE`, `SYSTEM_ERROR`.

## Authentication endpoints

### POST `/auth/token`

**Authentication:** Public

Request:

| Field | Type | Required | Nullable | Declared validation |
|---|---|---:|---:|---|
| `username` | string | Yes | No | Nonblank; maximum 15 characters |
| `password` | string | Yes | No | Nonblank; length 8–15 |

The controller does not apply `@Valid`; therefore, the declared field constraints are not enforced by this endpoint. Empty or malformed values may reach service logic.

Success: HTTP 200, `ApiResponse<AuthenticationResponse>`.

```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "token": "<JWT>",
    "authenticated": true
  }
}
```

Known application errors:

- `4002`, HTTP 400: username not found.
- `5001`, HTTP 400: password does not match.
- `9999`, HTTP 500: unhandled failure.

### POST `/auth/introspect`

**Authentication:** Public

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `token` | string | No | Yes | None |

Success: HTTP 200, `ApiResponse<IntrospectResponse>`.

```json
{
  "code": 1000,
  "message": "Success",
  "result": {
    "valid": true
  }
}
```

An invalid or expired token handled by the service returns `valid: false`. Null/malformed-body behavior is **UNVERIFIED**.

## User endpoints

### POST `/users`

**Authentication:** Public

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `username` | string | Yes | No | Nonblank; maximum 15 characters |
| `password` | string | Yes | No | Nonblank; length 8–15 |
| `name` | string | Yes | No | Nonblank; maximum 20 characters |
| `role` | enum string | Yes | No | `EMPLOYEE`, `MANAGER`, or `ADMIN` |

Success: HTTP 201, `ApiResponse<UserResponse>`.

Known errors:

- `1001`, HTTP 400: validation failure.
- `4001`, HTTP 400: username already exists.
- `9999`, HTTP 500: unhandled failure.

Security note: because this endpoint is public and `role` is caller-controlled, anonymous callers can currently request `ADMIN`.

### GET `/users`

**Authentication:** Bearer JWT with `SCOPE_ADMIN`

Success: HTTP 200, `ApiResponse<UserResponse[]>`.

Known security errors: HTTP 401 or 403; exact bodies are **UNVERIFIED**.

## Customer endpoints

### POST `/customers`

**Authentication:** Bearer JWT

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `name` | string | Yes | No | Nonblank; maximum 100 characters |
| `birthday` | string/date | Yes | No | Required; no age/future-date rule |
| `address` | string | Yes | No | Nonblank |
| `identityNo` | string | Yes | No | Nonblank; exactly 10 digits |
| `mobile` | string | No | Yes | If present/non-null, 9–10 digits |
| `customerType` | enum string | Yes | No | `INDIVIDUAL` or `CORPORATE` |
| `status` | integer | Yes | No | Required; allowed values not constrained |

Success: HTTP 201, `ApiResponse<CustomerResponse>`.

Known errors:

- `1001`, HTTP 400: validation failure.
- `2001`, HTTP 400: identity number already exists.
- HTTP 401: missing/invalid authentication; body **UNVERIFIED**.
- `9999`, HTTP 500: unhandled failure.

### GET `/customers/{id}`

**Authentication:** Bearer JWT

Path parameter:

- `id`: required integer/int64 customer identifier.

Success: HTTP 200, `ApiResponse<CustomerResponse>`.

Known errors:

- `2002`, HTTP 404: customer not found.
- Invalid `id` conversion: **UNVERIFIED**.

### PUT `/customers/{id}`

**Authentication:** Bearer JWT

Path parameter:

- `id`: required integer/int64 customer identifier.

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `name` | string | Yes | No | Nonblank; maximum 100 characters |
| `birthday` | string/date | Yes | No | Required |
| `address` | string | Yes | No | Nonblank |
| `mobile` | string | No | Yes | If present/non-null, 9–10 digits |
| `customerType` | enum string | Yes | No | `INDIVIDUAL` or `CORPORATE` |
| `status` | integer | Yes | No | Required; allowed values not constrained |

`identityNo` is not accepted by this request and cannot be updated.

Success: HTTP 200, `ApiResponse<CustomerResponse>`.

Known errors:

- `1001`, HTTP 400: validation failure.
- `2002`, HTTP 404: customer not found.

### DELETE `/customers/{id}`

**Authentication:** Bearer JWT

Path parameter:

- `id`: required integer/int64 customer identifier.

Success: HTTP 204 with no body. The customer is soft-deleted by setting status to `0`.

Known errors:

- `2002`, HTTP 404: customer not found.
- `2003`, HTTP 400: customer has an account with status `1`.

### GET `/customers`

**Authentication:** Bearer JWT

Query parameters:

| Name | Type | Required | Default |
|---|---|---:|---:|
| `page` | integer | No | `0` |
| `size` | integer | No | `10` |

Success: HTTP 200, `ApiResponse<PageResponse<CustomerResponse>>`.

Ordering: customer name ascending.

Explicit page/size bounds are not implemented; invalid values have **UNVERIFIED** error behavior.

### GET `/customers/by-field`

**Authentication:** Bearer JWT

Query parameters:

| Name | Type | Required | Nullable | Behavior |
|---|---|---:|---:|---|
| `name` | string | No | Yes | Case-insensitive substring |
| `identityNo` | string | No | Yes | Case-insensitive substring |
| `mobile` | string | No | Yes | Case-insensitive substring |
| `customerType` | enum string | No | Yes | Exact `INDIVIDUAL` or `CORPORATE` |
| `status` | integer | No | Yes | Exact integer |
| `page` | integer | No | No | Default `0` |
| `size` | integer | No | No | Default `10` |

All supplied filters are AND-combined. Results are sorted by customer name ascending.

Success: HTTP 200, `ApiResponse<PageResponse<CustomerResponse>>`.

Invalid enum or parameter conversion behavior is **UNVERIFIED**.

## Account endpoints

### POST `/accounts`

**Authentication:** Bearer JWT

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `accountNumber` | string | Yes | No | Nonblank; exactly 13 digits |
| `customerId` | integer/int64 | Yes | No | Required |
| `balance` | number/decimal | Yes | No | Required; greater than or equal to zero |

The service assigns status `3`; clients do not submit status.

Success: HTTP 201, `ApiResponse<AccountResponse>`.

Known errors:

- `1001`, HTTP 400: validation failure.
- `2002`, HTTP 404: customer not found.
- `3002`, HTTP 409: account number already exists.
- `9999`, HTTP 500: unhandled failure.

### GET `/accounts/{id}`

**Authentication:** Bearer JWT

Path parameter:

- `id`: required integer/int64 account identifier.

Success: HTTP 200, `ApiResponse<AccountResponse>`.

Known error: `3001`, HTTP 404, account not found.

### GET `/accounts/by-number/{accountNumber}`

**Authentication:** Bearer JWT

Path parameter:

- `accountNumber`: required string. No controller-level 13-digit validation is applied.

Success: HTTP 200, `ApiResponse<AccountResponse>`.

Known error: `3001`, HTTP 404, account not found.

### GET `/accounts`

**Authentication:** Bearer JWT

Query parameters:

| Name | Type | Required | Default |
|---|---|---:|---:|
| `page` | integer | No | `0` |
| `size` | integer | No | `10` |

Success: HTTP 200, `ApiResponse<PageResponse<AccountResponse>>`.

Ordering: associated customer name ascending.

Explicit page/size bounds are not implemented; invalid values have **UNVERIFIED** error behavior.

### GET `/accounts/{id}/active`

**Authentication:** Bearer JWT

Despite the generic name, `id` is a customer identifier.

Query parameters:

| Name | Type | Required | Default |
|---|---|---:|---:|
| `page` | integer | No | `0` |
| `size` | integer | No | `1` |

Success: HTTP 200, `ApiResponse<PageResponse<AccountResponse>>`.

Behavior:

- filters by customer identifier and account status `1`;
- orders by account number ascending;
- does not explicitly verify customer existence.

A nonexistent customer is expected to return an empty page, but this is **UNVERIFIED** without integration execution.

## Transaction endpoints

### POST `/transactions/transfer`

**Authentication:** Public

Request:

| Field | Type | Required | Nullable | Validation |
|---|---|---:|---:|---|
| `fromAccountNumber` | string | Yes | No | Nonblank; no 13-digit pattern validation |
| `toAccountNumber` | string | Yes | No | Nonblank; no 13-digit pattern validation |
| `amount` | number/decimal | Yes | No | Required; minimum `1000` |
| `content` | string | No | Yes | No length constraint |

Success: HTTP 200, `ApiResponse<TransactionResponse>`.

Business outcomes:

- sufficient balance: `status` is `SUCCESS`; balances are updated;
- insufficient balance: HTTP/application success with `status` `INSUFFICIENT_BALANCE`, unchanged balances, and `errorReason` `Insufficient balance`.

Known errors:

| Code | HTTP | Trigger |
|---:|---:|---|
| `1001` | 400 | Request validation failure |
| `6001` | 404 | Source account not found |
| `6002` | 400 | Source account status is not `1` |
| `6003` | 404 | Destination account not found |
| `6004` | 400 | Destination account status is not `1` |
| `6005` | 400 | Source and destination are equal |
| `6006` | 400 | Amount is less than `1000` |
| `9999` | 500 | Unhandled failure |

Code `6006` has a contradictory source message claiming a minimum of `0.01`. The implemented threshold is `1000`.

No idempotency, authenticated ownership check, currency, fee, maximum amount, or fractional-digit constraint is implemented.

### GET `/accounts/{accountNumber}/transactions`

**Authentication:** Bearer JWT

Path parameter:

- `accountNumber`: required string; source or destination account match.

Query parameters:

| Name | Type | Required | Default | Rules |
|---|---|---:|---:|---|
| `fromDate` | string/local-date-time | No | none | Inclusive lower bound; ISO date-time |
| `toDate` | string/local-date-time | No | none | Inclusive upper bound; ISO date-time |
| `page` | integer | No | `0` | Must be `>= 0` |
| `size` | integer | No | `10` | Must be `1..100` |

Success: HTTP 200, `ApiResponse<PageResponse<TransactionResponse>>`.

Ordering:

1. `transactionDate` descending;
2. `id` descending.

Known errors:

- `3001`, HTTP 404: account not found.
- `6007`, HTTP 400: `fromDate` is after `toDate`.
- `6008`, HTTP 400: invalid page or size.
- Malformed date conversion: **UNVERIFIED**.

## Application error catalog

| Code | HTTP | Source message | Verified use |
|---:|---:|---|---|
| `1000` | 200 in enum | `Success` | All success envelopes; HTTP may be 201 |
| `1001` | 400 | `Du lieu khong hop le` | Bean validation; message is replaced by first field error |
| `2001` | 400 | `Khach hang da ton tai` | Duplicate customer identity |
| `2002` | 404 | `Khach hang khong ton tai` | Customer not found |
| `2003` | 400 | `Khach hang con tai khoan dang hoat dong, khong the xoa` | Customer has status-1 account |
| `3001` | 404 | `Tai khoan khong ton tai` | Account not found |
| `3002` | 409 | `So tai khoan da ton tai` | Duplicate account number |
| `3003` | 400 | `Tai khoan khong o trang thai cho phe duyet` | Defined but no current endpoint use |
| `3004` | 400 | `Trang thai tai khoan khong hop le` | Defined but no current endpoint use |
| `4001` | 400 | `tai khoan dang nhap da ton tai` | Duplicate username |
| `4002` | 400 | `tai khoan khong ton tai` | Authentication user not found |
| `5001` | 400 | `dang nhap khong thanh conh` | Password mismatch |
| `6001` | 404 | `Tai khoan nguon khong ton tai` | Source transfer account missing |
| `6002` | 400 | `Tai khoan nguon khong hoat dong` | Source account not status 1 |
| `6003` | 404 | `Tai khoan dich khong ton tai` | Destination transfer account missing |
| `6004` | 400 | `Tai khoan dich khong hoat dong` | Destination account not status 1 |
| `6005` | 400 | `Tai khoan nguon va dich phai khac nhau` | Same source/destination |
| `6006` | 400 | `So tien chuyen toi thieu la 0.01` | Amount below implemented minimum 1000; message conflicts |
| `6007` | 400 | `Khoang thoi gian giao dich khong hop le` | Invalid date range |
| `6008` | 400 | `Thong tin phan trang khong hop le` | Invalid history pagination |
| `9999` | 500 | `Internal server error` | Generic controller exception fallback |

Messages are reproduced exactly as source strings; no translation or spelling correction is implied.

## Documentation conflicts and exclusions

The following are not part of the current API contract:

- README account PUT/DELETE endpoints;
- project-spec account approval/status endpoints;
- `/customers/search` from the project specification;
- report or export endpoints;
- customer types `PERSONAL` and `BUSINESS`;
- string error codes such as `CUSxxx` or `ACCxxx`.

Current source instead uses the mappings, enum names, and integer codes documented above.

## Verification matrix

| Contract area | Primary sources |
|---|---|
| Endpoint mappings/statuses | `controller/*Controller.java` |
| Authentication/authorization | `config/SecurityConfig.java`, `service/impl/AuthenticationServiceImpl.java` |
| Request names/validation | `dto/request/*.java` and controller `@Valid` usage |
| Response names | `dto/response/*.java` and mapper interfaces |
| Errors | `exception/ErrorCode.java`, `GlobalExceptionHandler.java`, service implementations |
| Customer filtering/sorting | `specification/CustomerSpecification.java`, customer repository/service |
| Account ordering/status behavior | account repository/service |
| Transfer rules | `service/impl/TransactionServiceImpl.java` |
| History pagination/date rules | transaction controller/service/repository |
| Date and numeric storage | relevant DTOs and entities |

Runtime integration tests are still required to resolve all items explicitly marked **UNVERIFIED**, especially null serialization, security error bodies, malformed-input handling, timestamp precision/timezone, decimal rounding, and nonexistent-customer active-account behavior.
