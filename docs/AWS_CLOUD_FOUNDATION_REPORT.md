# ZAMORIN CAFÉ ERP
## AWS CLOUD FOUNDATION & SCALABILITY-STAGING ARCHITECTURE REPORT

**Programme**: Enterprise Cloud Foundation & AWS Account Structure  
**Target Workload**: 50,000 Live Devices & 10,000 Concurrent Users Scalability Validation  
**Workload Region**: `ap-south-1` (Mumbai)  
**Live Verification Status**: `NOT_VERIFIED_LIVE` (Local Architecture Specification Phase Complete; Live Account Bootstrap Pending)

---

### 1. Control Plane Verification Status

| Component | Target Identity | Specification Status | Live AWS Verification |
|---|---|---|---|
| **AWS Management Account** | `Zamorin-Cloud-Management` | `SPECIFIED` | `NOT_VERIFIED_LIVE` |
| **AWS Organization** | All-Features Mode | `SPECIFIED` | `NOT_VERIFIED_LIVE` |
| **Organizational Unit (OU)** | `Zamorin-NonProduction` | `SPECIFIED` | `NOT_VERIFIED_LIVE` |
| **Scale Member Account** | `Zamorin-Scale-Staging` | `SPECIFIED` | `NOT_VERIFIED_LIVE` |
| **IAM Identity Center** | Centralized SSO Directory | `SPECIFIED` | `NOT_VERIFIED_LIVE` |
| **AWS CLI v2** | `aws --version` | `REQUIRED` | `NOT_INSTALLED` |
| **SSO Profile** | `zamorin-scale` | `SPECIFIED` | `NOT_CONFIGURED` |
| **STS Authentication** | `aws sts get-caller-identity` | `REQUIRED` | `NOT_VERIFIED_LIVE` |
| **Monthly Budget** | `Zamorin-Scale-Staging-Monthly` | `SPECIFIED` | `NOT_CREATED` |
| **Terraform CLI** | `terraform version` | `REQUIRED` | `NOT_INSTALLED` |

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

### 3. Human Security Checkpoint Protocol

During the live AWS registration and setup process, all sensitive operations must be completed privately by the human administrator. The automated assistant will pause and display the designated checkpoint notice at:
1. Root email entry
2. Email OTP / verification link
3. Root password creation
4. Contact & legal business details
5. Payment & credit card details
6. Phone SMS OTP / CAPTCHA
7. Root MFA QR & TOTP enrollment
8. Member account unique email entry
9. SSO user invitation & password setup
10. Monthly budget dollar authorization
