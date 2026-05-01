# Security Specification: Rexocollab

## 1. Data Invariants
- A **User** must have a valid `role` (creator, brand, or admin).
- A **Campaign** must be owned by a `brandId` and have a `status` from the allowed enum.
- An **Application** must reference a valid `campaignId` and `creatorId`.
- Only the owner of a document can modify its sensitive fields.
- Brands can only manage campaigns they created.
- Creators can only manage applications they submitted.

## 2. The "Dirty Dozen" Payloads (Exploit Attempts)
1. **Identity Theft**: Creator A attempts to update Creator B's profile.
2. **Role Escalation**: Brand user tries to change their role to 'admin'.
3. **Ghost Campaign**: Anonymous user tries to create a campaign.
4. **Budget Hijack**: Creator A tries to update the budget of Brand X's campaign.
5. **Application Spoofing**: Creator A tries to submit an application on behalf of Creator B.
6. **Cross-Brand Snooping**: Brand A tries to read applications sent to Brand B's campaign.
7. **Status Shortcutting**: Creator tries to mark a campaign as 'completed'.
8. **Shadow Field Injection**: User adds a hidden `isVerified: true` field to their profile.
9. **ID Poisoning**: User uses a 1MB string as a document ID.
10. **Orphaned Application**: User creates an application for a non-existent campaign.
11. **PII Leak**: Non-admin user tries to fetch a list of all user emails.
12. **Recursive Cost Attack**: Malicious user attempts deeply nested queries to exhaust Firestore resources.

## 3. The Test Runner Logic
I will implement `firestore.rules.test.ts` to verify that all the above payloads are correctly rejected with `PERMISSION_DENIED`.
