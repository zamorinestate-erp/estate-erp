# ZAMORIN CAFÉ ERP
## AWS SCALABILITY-STAGING BUDGET POLICY & COST MANAGEMENT

### 1. Cost Safety Policy

Cloud load testing with 50,000 live device streams and 10,000 active virtual users involves real compute, network, and load-balancer resources. To prevent unexpected expenditure, the following governance rules are enforced:

1. **Explicit Budget Authorization**: No cloud resources may be provisioned without explicit human authorization of the maximum monthly budget ceiling.
2. **Dedicated Budget Configuration**: Budget name: `Zamorin-Scale-Staging-Monthly`.
3. **Notification Thresholds**:
   - **25% of Budget**: Early warning notification
   - **50% of Budget**: Operational checkpoint notification
   - **75% of Budget**: High-spend notification
   - **90% of Budget**: Approaching ceiling notification
   - **100% of Budget**: Ceiling reached notification
   - **Forecast Alert**: Triggered when forecasted spend reaches 80–100% of budget.

---

### 2. Critical Operational Disclaimer

> [!IMPORTANT]
> **AWS BUDGET ALERTS ARE NOT AN AUTOMATIC HARD SPENDING CAP.**
> AWS Budgets dispatch email/SNS notifications when cost thresholds are breached. They do NOT automatically destroy or terminate running EC2/ECS/ALB resources. Administrators are responsible for monitoring active scale tests and initiating Terraform teardown (`terraform destroy`) upon completion of the test plateau.

---

### 3. AWS Cost Anomaly Detection

- AWS Cost Anomaly Detector configured with a low-variance threshold for the `Zamorin-Scale-Staging` account.
- Immediate alert dispatch to administrative notification targets upon detecting abnormal cost spikes.
