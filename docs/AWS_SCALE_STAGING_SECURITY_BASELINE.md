# ZAMORIN CAFÉ ERP
## AWS SCALABILITY-STAGING SECURITY BASELINE

### 1. Root Account Security Standards

- **Mandatory MFA**: The root user of `Zamorin-Cloud-Management` must have multi-factor authentication enabled immediately upon account creation.
- **Zero Root Access Keys**: No access key ID (`AKIA...`) or secret access key may ever be generated for the root account.
- **Break-Glass Usage Only**: Root login is restricted to initial organization bootstrap, account recovery, and critical tax/billing updates.

---

### 2. Workload Region Policy

- **Primary Region**: `ap-south-1` (AWS Asia Pacific - Mumbai).
- **Rationale**: Minimal latency to Zamorin Cafe outlet devices across South India and compliance with data residency best practices.
- **Global Services**: Region restrictions do not block global services (IAM, CloudFront, Route53, AWS Organizations).

---

### 3. Resource Governance & Mandatory Tagging

Every resource created by Terraform or the scale validation harness must carry the following tags:

```hcl
default_tags {
  tags = {
    Project     = "ZamorinCafeERP"
    Purpose     = "EnterpriseScaleValidation"
    Environment = "ScalabilityStaging"
    Owner       = "Zamorin"
    AutoCleanup = "True"
  }
}
```

---

### 4. CloudTrail & Security Telemetry

- Multi-region CloudTrail enabled at the AWS Organizations level.
- Management events logged to an encrypted, access-restricted S3 bucket.
- Log file integrity validation enabled.
