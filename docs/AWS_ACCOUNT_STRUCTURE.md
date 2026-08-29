# ZAMORIN CAFÉ ERP
## AWS ACCOUNT STRUCTURE & ORGANIZATIONAL TOPOLOGY

### 1. Account Tree Structure

```text
Zamorin-Cloud-Management (Management Account)
├── Root Account ID: [MASKED_MGMT_ID]
├── Security Level: Governance & Billing Only (0 Workloads)
├── MFA: Enabled (Authenticator App / FIDO2 Key)
│
└── AWS Organization (Feature Set: ALL)
      │
      └── Organizational Unit: Zamorin-NonProduction
            │
            └── Member Account: Zamorin-Scale-Staging
                  ├── Member Account ID: [MASKED_STAGING_ID]
                  ├── Root Email: Dedicated Non-Shared Alias
                  ├── Cross-Account Admin Role: OrganizationAccountAccessRole
                  ├── Environment: ScalabilityStaging
                  └── Default Region: ap-south-1 (Mumbai)
```

---

### 2. Account Specifications

| Attribute | Management Account | Scalability-Staging Member Account |
|---|---|---|
| **Account Name** | `Zamorin-Cloud-Management` | `Zamorin-Scale-Staging` |
| **Primary Function** | Orgs, Billing, IAM Identity Center, SCPs | Scale testing, ALB, ECS, Redis, Load Generators |
| **Workloads Permitted** | **NONE (Strict 0-Workload Rule)** | Scalability Validation Staging Only |
| **Root User Access** | Break-glass emergency only | Managed via OrganizationAccountAccessRole |
| **Human Access Method** | IAM Identity Center Portal | IAM Identity Center (`zamorin-scale` CLI profile) |
| **Default Region** | `ap-south-1` | `ap-south-1` |
| **Static IAM Keys** | **0** | **0** |

---

### 3. Workload Isolation Rules

1. **Management Account Protection**: No application container, database, Redis cache, or load testing script may ever target the management account.
2. **Environment Separation**: Scalability staging is fully partitioned from existing or future production environments, preventing accidental cross-talk, resource contention, or data exposure.
3. **Dedicated Staging Email**: Member account uses a dedicated, non-public email address managed by the organization.
