# ZAMORIN CAFÉ ERP
## AWS IAM IDENTITY CENTER & FEDERATED WORKFORCE ACCESS

### 1. Identity Architecture

AWS IAM Identity Center provides centralized human authentication and single sign-on access without creating static IAM user credentials:

```text
[Human Administrator]
       │
       ▼ (HTTPS / MFA Authentication)
[AWS Access Portal] (IAM Identity Center Directory)
       │
       ▼ (Federated Temporary Token)
[Zamorin-Scale-Staging Member Account]
       │
       ▼ (Role Assumption)
[AdministratorAccess / ScaleTestingPermissionSet]
```

---

### 2. Identity Center Configuration Standards

1. **Directory Type**: AWS IAM Identity Center default identity store.
2. **Workforce Identity**: Dedicated administrative user profile configured with mandatory Multi-Factor Authentication (MFA).
3. **Session Duration**: 1 to 8 hours max temporary session duration.
4. **Permission Sets**:
   - `AdministratorAccess`: Bound strictly to the `Zamorin-Scale-Staging` member account for initial infrastructure provisioning.
   - `ScaleOperationsAccess`: Restricted operational permission set for load test execution and telemetry monitoring.
5. **Account Assignment**: The administrative identity is assigned to `Zamorin-Scale-Staging` and is NOT assigned broad permissions in the root management account.

---

### 3. Human Security Checkpoints

During initial setup and authentication, human security checkpoints are strictly observed:
- User email verification completed privately by user.
- Password creation entered directly on AWS portal (never shared with AI assistant).
- MFA device registration (Authenticator app / FIDO2 security key) enrolled privately.
- Temporary token issuance via `aws sso login` approved in browser session.
