# 11. Security Architecture

Defense-in-depth across edge, application, data, and operations. Aligns to **OWASP Top 10** and
**OWASP ASVS L2**.

## 11.1 Authentication
- **JWT access tokens** (short-lived, 15 min, RS256 asymmetric signing) + **rotating refresh
  tokens** stored hashed in `auth_sessions`, delivered as `httpOnly`, `Secure`, `SameSite=Lax`
  cookies. Refresh rotation with reuse-detection (revoke family on replay).
- **2FA (TOTP)** for all staff accounts (`users.two_factor_secret`); enforced for admin roles.
- OAuth/social login optional for end-users; password hashing with **Argon2id**.
- Brute-force protection: per-account + per-IP throttling, exponential backoff, CAPTCHA after N fails.

## 11.2 Authorization (RBAC)
- Roles → permissions (`role_permissions`) + per-user grant/deny overrides (`user_permissions`).
- Server-side enforcement via `PermissionsGuard` + `@Permissions('product.update')` decorators;
  **never** trust the client. Admin UI hides controls but API re-checks every request.
- Row-level scoping where needed (e.g. Vendor Manager limited to assigned brands/stores).
- Principle of least privilege; system roles immutable (`roles.is_system`).

## 11.3 Web Vulnerability Mitigations
| Threat | Mitigation |
|--------|-----------|
| **XSS** | React auto-escaping; sanitize MDX/HTML content (DOMPurify server-side) before store/render; strict **CSP** (`script-src 'self'` + nonces), `Trusted Types` |
| **CSRF** | SameSite cookies + double-submit CSRF token on state-changing requests; JSON-only APIs reject form posts |
| **SQL Injection** | Parameterized queries / ORM (Prisma/TypeORM); no string-built SQL; `pg_trgm` search via bound params |
| **SSRF** | Crawlers/feeds fetch via allowlist + blocked internal CIDRs; metadata endpoint blocked |
| **Clickjacking** | `X-Frame-Options: DENY` / `frame-ancestors 'none'` |
| **Open redirect** | `/go/{code}` only redirects to validated, store-owned domains |
| **Mass assignment** | DTO allowlists (Zod) — never bind raw body to entities |
| **IDOR** | Object-level auth checks on every `/{id}` route |

## 11.4 Edge & Network Security
- **Cloudflare WAF** (OWASP ruleset), **DDoS protection**, **Bot Management** (separate good bots
  / scrapers), rate limiting at edge before origin.
- TLS 1.3 everywhere, HSTS preload, mTLS between internal services (mesh) where applicable.
- Private subnets for DB/Redis/search; only ALB/ingress public. Security groups least-privilege.

## 11.5 Rate Limiting & Abuse
- Tiered sliding-window limits in Redis: anonymous (e.g. 60 r/m), authenticated, partner API keys.
- Stricter limits on `/auth/*`, `/search`, `/go/*`; per-key quotas for GraphQL with depth/complexity caps + persisted queries.
- Affiliate click fraud detection: IP-hash velocity, bot UA filtering, dedupe within window.

## 11.6 Data Protection & Privacy
- Encryption in transit (TLS) and at rest (RDS/S3 KMS-encrypted, encrypted EBS).
- PII minimization: IPs **hashed** in `affiliate_clicks`; secrets in **AWS Secrets Manager**
  (rotated), never in code/env files committed.
- **GDPR/CCPA**: cookie consent (gates ad/analytics scripts), data export + right-to-erasure flows,
  data retention policies (§2.6), regional data handling.
- Soft-delete + audited hard-delete for erasure requests.

## 11.7 Security Headers (every response)
```
Content-Security-Policy: default-src 'self'; img-src 'self' https://cdn.gadgethub.com data:;
  script-src 'self' 'nonce-...' https://pagead2.googlesyndication.com; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

## 11.8 Auditing & Monitoring
- **Audit logs** (`activity_logs`) record actor, action, before/after diff, IP, UA on every mutation.
- Security event logging → SIEM; anomaly alerts (privilege escalation, mass export, failed-auth spikes).
- Dependency scanning (Dependabot/Snyk), SAST (CodeQL/Semgrep), DAST on staging, container image
  scanning (Trivy), IaC scanning (tfsec/Checkov) — all gated in CI/CD.
- Secrets scanning (gitleaks) in pre-commit + CI; least-privilege IAM; signed images (cosign).
- Regular pen-tests + bug-bounty; incident response runbook + on-call.
