# Onboarding

## Public

The farmer opens the registration page directly or through `/r/{code}`, enters personal, farm, login, and payment details, reviews the fixed ₹500 fee, and completes Razorpay checkout.

## Employee assisted

An authenticated employee opens onboarding, enters the farmer's details, identifies whether cash was received, and completes online payment. The farmer chooses the account password. The employee is stored as onboarding attribution.

## Completion

The browser verifies the payment for immediate feedback. A signed webhook independently reconciles the same payment. Both paths run the same idempotent finalization operation. The resulting receipt can be printed or saved as PDF on the device.
