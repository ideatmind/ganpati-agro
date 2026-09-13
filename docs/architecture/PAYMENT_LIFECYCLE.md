# Payment lifecycle

```text
draft registration → Razorpay order created → checkout attempted
       ↓                                      ↓
 payment pending ← failed/closed         captured payment
                                              ↓
                               idempotent finalization
                                              ↓
                       farmer + membership + receipt
                                  + optional earning
```

Browser verification gives immediate confirmation. The webhook and reconciliation path recover interrupted browser flows.
