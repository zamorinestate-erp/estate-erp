# ZAMORIN CAFÉ ERP
## AWS CLI V2 SSO PROFILE CONFIGURATION & VERIFICATION

### 1. Prerequisites

1. Official AWS CLI v2 installed on the developer/administrator workstation.
2. IAM Identity Center configured in `Zamorin-Cloud-Management`.
3. Administrative user assigned to `Zamorin-Scale-Staging` with `AdministratorAccess` permission set.

---

### 2. SSO Configuration Command

Run the interactive AWS CLI SSO setup:

```bash
aws configure sso
```

When prompted, enter:
- **SSO session name**: `zamorin-sso`
- **SSO start URL**: `https://[your-identity-center-prefix].awsapps.com/start`
- **SSO region**: `ap-south-1`
- **SSO registration scopes**: `sso:account:access`
- **Select Account**: Choose `Zamorin-Scale-Staging`
- **Select Role**: Choose `AdministratorAccess`
- **CLI default client Region**: `ap-south-1`
- **CLI default output format**: `json`
- **CLI profile name**: `zamorin-scale`

---

### 3. Generated `~/.aws/config` Profile

```ini
[profile zamorin-scale]
sso_session = zamorin-sso
sso_account_id = [MASKED_STAGING_ACCOUNT_ID]
sso_role_name = AdministratorAccess
region = ap-south-1
output = json

[sso-session zamorin-sso]
sso_start_url = https://[your-identity-center-prefix].awsapps.com/start
sso_region = ap-south-1
sso_registration_scopes = sso:account:access
```

---

### 4. Authentication & Verification Workflow

1. **Initiate SSO Login**:
   ```bash
   aws sso login --profile zamorin-scale
   ```
   *Action*: Browser opens AWS Access Portal for private human authentication and MFA approval.

2. **Verify Temporary Token**:
   ```bash
   aws sts get-caller-identity --profile zamorin-scale
   ```
   *Expected Output*:
   ```json
   {
       "UserId": "AROA...:user-admin",
       "Account": "[MASKED_STAGING_ACCOUNT_ID]",
       "Arn": "arn:aws:sts::[MASKED_STAGING_ACCOUNT_ID]:assumed-role/AWSReservedSSO_AdministratorAccess_.../user-admin"
   }
   ```
