# ZAMORIN CAFÉ ERP
## AWS CLOUD FOUNDATION & SCALABILITY-STAGING ARCHITECTURE REPORT

**Programme**: Enterprise Cloud Foundation & AWS Account Structure  
**Target Workload**: 50,000 Live Devices & 10,000 Concurrent Users Scalability Validation  
**Workload Region**: `ap-south-1` (Mumbai)  
**Status**: Foundation Architecture & Security Baseline Established  

---

### 1. Executive Summary

This document establishes the official enterprise cloud account foundation for Zamorin Café ERP. The cloud architecture enforces strict multi-account isolation, root-level hardening, centralized workforce identity governance, and budget controls:

```
Zamorin-Cloud-Management (AWS Management Account)
│
└── AWS Organization (Feature Set: ALL)
      │
      └── OU: Zamorin-NonProduction
            │
            └── Member Account: Zamorin-Scale-Staging (Workload Account)
```

---

### 2. Multi-Account Hierarchy & Isolation Principles

1. **Management Account (`Zamorin-Cloud-Management`)**:
   - **Dedicated Purpose**: AWS Organizations governance, centralized billing, Identity Center directory, and Service Control Policies (SCPs).
   - **Workload Prohibition**: Under no circumstances are application workloads (API containers, Redis clusters, database clusters, or load generators) provisioned in the management account.
   - **Root Security**: Root account protected with hardware/authenticator MFA; 0 root access keys permitted.

2. **Organizational Unit (`Zamorin-NonProduction`)**:
   - Isolates non-production environments from future production organizational units.
   - Applies staging-specific security baselines and budget policies.

3. **Scale-Staging Member Account (`Zamorin-Scale-Staging`)**:
   - Dedicated AWS account created via AWS Organizations (`OrganizationAccountAccessRole`).
   - Hosts all scalability validation infrastructure (ALB, ECS cluster, ElastiCache Redis, load generators).
   - Completely isolated from production customer data, payment gateways, and live business operations.

---

### 3. Human Identity & Access Management (IAM Identity Center)

- **Centralized Workforce Identity**: Human access is managed exclusively through AWS IAM Identity Center (formerly AWS SSO).
- **Zero Static Human Credentials**: No long-lived IAM access keys (`AKIA...`) are created for human administrators.
- **Temporary Role Assumption**: Access is granted via temporary, short-lived security tokens via `aws sso login`.
- **Administrative Access**: Scoped to the `Zamorin-Scale-Staging` member account using a designated permission set.

---

### 4. Cost Governance & Spending Safety

- **Dedicated Account Budget**: `Zamorin-Scale-Staging-Monthly`
- **Multi-Tier Notification Thresholds**: 25%, 50%, 75%, 90%, 100% of budgeted spend, plus forecast notifications at 80–100%.
- **Policy Invariant**: AWS Budgets deliver notification alerts and do not act as an automatic destructive shutdown. Cloud resources must be monitored and torn down after benchmark execution.
- **Resource Tagging**: All scale infrastructure carries mandatory governance tags:
  - `Project`: `ZamorinCafeERP`
  - `Purpose`: `EnterpriseScaleValidation`
  - `Environment`: `ScalabilityStaging`
  - `Owner`: `Zamorin`
  - `AutoCleanup`: `True`
