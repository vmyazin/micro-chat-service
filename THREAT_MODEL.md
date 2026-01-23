# MicroChat Threat Model

## Adversary Capabilities

### 1. Curious Operator (Us)
**Capability:** Full access to server infrastructure, databases, logs, and network traffic.

**Mitigation:** End-to-end encryption ensures we cannot read message content. We only see encrypted blobs and minimal metadata.

### 2. Malicious Group Member
**Capability:** Access to group messages while a member; may try to add unauthorized members or retain access after removal.

**Mitigation:** MLS provides forward secrecy and post-compromise security. Removed members cannot decrypt new messages. Group state is cryptographically enforced.

### 3. Compromised Client Device
**Capability:** Access to local keys and message history on that device.

**Mitigation:** Per-device keys allow revocation without affecting other devices. Post-compromise security means new keys are established after device removal.

### 4. Passive Network Observer
**Capability:** Observe encrypted traffic patterns, timing, and metadata.

**Mitigation:** TLS for transport. Minimal metadata exposure. Traffic analysis is partially mitigated but acknowledged as a limitation.

### 5. Server Seizure / Subpoena
**Capability:** Access to all stored data at a point in time.

**Mitigation:** Crypto-erasure deletes encryption keys, rendering stored ciphertexts permanently unreadable. Minimal retention policy limits exposure window.

### 6. Nation-State Adversary
**Capability:** Sustained access, device implants, cryptographic attacks, legal compulsion.

**Mitigation:** Standard protocols (MLS) audited by cryptographers. No custom cryptography. Crypto-erasure limits historical exposure. Some attacks (device compromise) are out of scope.

## Security Guarantees

- **Message confidentiality:** Only group members can read messages
- **Forward secrecy:** Compromise of current keys doesn't expose past messages
- **Post-compromise security:** Recovery from key compromise via key rotation
- **Group integrity:** Cryptographic enforcement of membership
- **Crypto-erasure:** Deleted groups are permanently unreadable

## Non-Guarantees

- **Metadata privacy:** We see who talks to whom and when (necessary for message routing)
- **Traffic analysis resistance:** Message timing and sizes are observable
- **Device security:** We cannot protect against compromised endpoints
- **Screenshot/copy protection:** Recipients can always copy decrypted content
- **Deniability:** We do not provide cryptographic deniability

## Protocol: MLS (RFC 9420)

MLS (Messaging Layer Security) is the IETF standard for secure group messaging.

### Why MLS?
- **Standardized:** RFC 9420, vetted by cryptographers
- **Efficient:** Sublinear scaling for group operations
- **Forward secrecy:** Per-message key derivation
- **Post-compromise security:** Regular key rotation heals from compromise
- **Multi-device:** Native support for multiple devices per user

### Implementation Notes
- Use established MLS library (e.g., OpenMLS, mls-rs)
- No custom cryptographic primitives
- Regular security audits recommended

## Crypto-Erasure Design

When a group is deleted:

1. **Key deletion:** All group epoch keys are securely deleted from server storage
2. **Ciphertext retention:** Encrypted messages become permanently unreadable
3. **Verification:** Deletion is logged and auditable
4. **Propagation:** Deletion signal sent to all group members' devices

### Storage Architecture
- Encryption keys stored separately from encrypted content
- Keys in volatile/securely-erasable storage where possible
- Content can be in durable storage (useless without keys)

## Retention Policy

| Data Type | Retention |
|-----------|-----------|
| Encrypted messages | Until group deletion or user-initiated delete |
| Encryption keys | Until group deletion (then crypto-erased) |
| Group membership | Active groups only |
| Delivery receipts | 30 days |
| Authentication logs | 90 days (security requirement) |
| Server access logs | 30 days |

## Honest Marketing Language

### Do Say
- "End-to-end encrypted — we can't read your messages"
- "Server-side crypto-erasure when groups are deleted"
- "Minimal metadata retention"
- "Built on audited, standard protocols (MLS - RFC 9420)"

### Don't Say
- ❌ "Zero knowledge" (we know metadata)
- ❌ "Military-grade encryption" (meaningless marketing)
- ❌ "Unbreakable" (nothing is)
- ❌ "Anonymous" (we have user accounts)
- ❌ "No logs" (we have operational logs)

### Transparency
- Publish this threat model
- Document what we can and cannot see
- Regular transparency reports
- Open-source cryptographic components
