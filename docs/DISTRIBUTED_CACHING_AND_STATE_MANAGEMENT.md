# ZAMORIN CAFÉ ERP — DISTRIBUTED CACHING & STATE MANAGEMENT

> **Multi-Instance Coordination**: Redis Pub/Sub + Ephemeral Stores + Local Fallback  
> **Confidence Status**: **VERIFIED_CLUSTER_TEST & ARCHITECTURAL_TARGET**  

---

## 1. Process-Local vs Distributed State Matrix

```
+------------------------------------+--------------------------+------------------------------+
| State Component                    | Primary Shared Authority | Fallback on Redis Outage     |
+------------------------------------+--------------------------+------------------------------+
| User Sessions & JWTs               | MongoDB `sessions`       | Authoritative database check |
| Device Registrations & Trust       | MongoDB `device_reg...`  | Local verified cache         |
| Operator PIN Rate Limits           | Redis Hash Key / TTL     | Degraded local in-memory Map |
| Device Presence (Last Ping)        | Redis String Key (90s TTL)| Local presence Map           |
| Scheduled Job Mutex Locks          | Redis Lua Mutex Script   | Local node-lease lock        |
| Cross-Instance Revocation Broadcast| Redis Pub/Sub Channel    | Direct DB polling check      |
| Static Reference & Role Perms      | In-Memory Immutable Map  | Local constant lookup        |
+------------------------------------+--------------------------+------------------------------+
```

---

## 2. Distributed Rate Limiting Keyspace

Keys are scoped across 6 dimensions to prevent cross-tenant or cross-device false collisions:
```
rl:<organisationId>:<cafeId>:<deviceId>:<userId>:<ip>:<scope>
```
Example:
```
rl:ZAMORIN:ZC-0042:DEV-000184:USR-00412:10.0.4.12:PIN
```
