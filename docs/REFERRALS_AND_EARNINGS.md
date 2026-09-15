# Referrals and earnings

Each eligible account has one immutable referral code and link. Attribution is resolved from that code and frozen at checkout. A registration has at most one commission recipient.

An earning stores fee amount, rate in basis points, calculated amount, registration, recipient, and credited time. The implemented balance is total credited earnings minus recorded offline payouts for that recipient. The payout RPC serializes balance checks and retries by UUID. Although an allocation table exists, this release does not populate it or offer an adjustment editor; do not describe allocations or adjustments as an implemented workflow.

The administration form saves the exact pending payout payload and UUID in session storage scoped to the signed-in account. If a response is lost, retry that saved request before recording another payout. A retry cannot change its recipient, amount or reference. Closing the browser tab can lose session storage; resolve uncertain records through retained database history before issuing a new UUID.

Permanent profile deletion retains credited earnings, payouts and balances. Recent credited entries use an anonymous name when the referred farmer's person profile has been erased. Issued financial documents remain historical records.
