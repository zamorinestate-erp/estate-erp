# ZAMORIN CAFÉ ERP
## AWS ACCOUNT STRUCTURE & ORGANIZATIONAL TOPOLOGY

### 1. Target Account Topology (Specification)

```text
Zamorin-Cloud-Management (Management Account) [NOT_VERIFIED_LIVE]
├── Status: SPECIFIED (Pending Live Bootstrap)
├── Security Level: Governance & Billing Only (0 Workloads)
├── MFA: Required (Authenticator App / FIDO2 Key)
│
└── AWS Organization (Feature Set: ALL) [NOT_VERIFIED_LIVE]
      │
      └── Organizational Unit: Zamorin-NonProduction [NOT_VERIFIED_LIVE]
            │
            └── Member Account: Zamorin-Scale-Staging [NOT_VERIFIED_LIVE]
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
| **Live Verification Status** | `NOT_VERIFIED_LIVE` | `NOT_VERIFIED_LIVE` |
