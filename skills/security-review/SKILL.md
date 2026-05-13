name: security-review
description: "Security code review for vulnerabilities"
version: "1.0.0"
triggers: ["security", "vulnerability", "audit", "owasp", "cve", "penetration"]

## OWASP Top 10 Checklist

### 1. Injection Prevention
- [ ] SQL queries use parameterized statements
- [ ] No string concatenation in queries
- [ ] Command injection sanitization
- [ ] LDAP injection prevention

### 2. Authentication
- [ ] Password hashing (bcrypt, argon2)
- [ ] Rate limiting on login
- [ ] Session management secure
- [ ] MFA implementation

### 3. Sensitive Data Exposure
- [ ] No secrets in code
- [ ] Environment variables for config
- [ ] Encryption at rest
- [ ] Encryption in transit (TLS)

### 4. XML External Entities (XXE)
- [ ] XML parser XXE disabled
- [ ] Document type definitions disabled

### 5. Broken Access Control
- [ ] Authorization checks on all endpoints
- [ ] Principle of least privilege
- [ ] CORS properly configured
- [ ] IDOR prevention

### 6. Security Misconfiguration
- [ ] No debug mode in production
- [ ] Security headers set
- [ ] Unnecessary features disabled
- [ ] Error messages don't leak info

### 7. Cross-Site Scripting (XSS)
- [ ] Input sanitization
- [ ] Output encoding
- [ ] CSP headers
- [ ] No innerHTML usage

### 8. Insecure Deserialization
- [ ] No untrusted serialization
- [ ] Integrity checks on serialized data

### 9. Vulnerable Components
- [ ] Dependencies up to date
- [ ] No known CVEs
- [ ] Using security scanning tools

### 10. Insufficient Logging
- [ ] Security events logged
- [ ] No sensitive data in logs
- [ ] Log monitoring in place
- [ ] Alert system configured

## Code Review Commands

### Search for Common Vulnerabilities
```bash
# SQL injection risks
grep -r "execute\|query\|raw" --include="*.ts" --include="*.js"

# Hardcoded secrets
grep -r "password\|secret\|api_key\|token" --include="*.ts" --include="*.js"

# Eval usage
grep -r "eval\|Function(" --include="*.ts" --include="*.js"

# Unsafe file operations
grep -r "fs\." --include="*.ts" --include="*.js" | grep -v "readFile\|writeFile"
```

## Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## Secret Detection

### Never Commit
- API keys
- Database passwords
- JWT secrets
- Private keys
- AWS credentials
- OAuth tokens

### Use Environment Variables
```bash
# .env (never commit)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
API_KEY=your-api-key

# .env.example (safe to commit)
DATABASE_URL=
JWT_SECRET=
API_KEY=
```

## Tools Integration

### Use These Tools for Review
1. `read_file` - Read suspicious files
2. `grep_search` - Find vulnerability patterns
3. `glob_search` - Find all config files
4. `bash` - Run security scanners

### Recommended Scanners
```bash
# Dependency scanning
npm audit
npx snyk test

# Static analysis
npx eslint --plugin security
npx ts-scan

# Secret scanning
npx git-secrets --scan
```

## Reporting Format

```
## Security Review Report

### Critical Issues
- [ ] Issue description
  - Location: file:line
  - Risk: High
  - Fix: Recommended solution

### Medium Issues
- [ ] Issue description

### Low Issues
- [ ] Issue description

### Passed Checks
- [x] Check description
```

## When to Use

- Before production deployments
- After adding authentication
- When handling sensitive data
- Before open-sourcing code
- Regular security audits
