export interface DashboardData {
  roles: string[];
  earnedPaise: number;
  paidPaise: number;
  availablePaise: number;
  referralCode: string;
  successfulReferrals: number;
  onboardedFarmers: number;
  cashPending: number;
  totalFarmers: number | null;
  recentEarnings: { amountPaise: number; creditedAt: string; farmerName: string; reference: string }[];
  recentPayouts: { amountPaise: number; method: string; reference: string | null; paidAt: string }[];
}

export interface ReceiptData { membershipType:"standard"|"focused_value_chain"; receiptNumber: string; registrationReference: string; membershipNumber: string; memberName: string; memberMobile: string; amountPaise: number; currency: string; paymentId: string; issuedAt: string }
