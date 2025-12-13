# Settlement Calculation Verification

## Overview
This document verifies the dual-flow settlement calculation implemented in the Owner Portal's Payout view.

## Settlement Logic

### Key Formula
```
Net Settlement = (Hostizzy owes Owner) - (Owner owes Hostizzy)
```

Where:
- **Hostizzy owes Owner**: Owner's share from payments received by Hostizzy
- **Owner owes Hostizzy**: Commission due from payments received by Owner

---

## Calculation Steps

### 1. Payments to Owner
When a payment goes **directly to the Owner**:
```javascript
totalToOwner += paymentAmount
proportionalCommission = (paymentAmount / bookingTotal) × bookingCommission
commissionFromOwnerPayments += proportionalCommission
```

**Result**: Owner receives the payment but owes commission to Hostizzy

---

### 2. Payments to Hostizzy
When a payment goes **to Hostizzy**:
```javascript
totalToHostizzy += paymentAmount
proportionalCommission = (paymentAmount / bookingTotal) × bookingCommission
ownerShare = paymentAmount - proportionalCommission
ownerShareFromHostizzyPayments += ownerShare
```

**Result**: Hostizzy receives the payment but owes the owner's share to Owner

---

### 3. Net Settlement
```javascript
netSettlement = ownerShareFromHostizzyPayments - commissionFromOwnerPayments
```

**Interpretation**:
- **Positive**: Hostizzy owes Owner → Display "Payout Pending"
- **Negative**: Owner owes Hostizzy → Display "Payment Pending"

---

## Verification Examples

### Example 1: Single Booking - 100% Payment to Owner

**Booking Details:**
- Total Amount: ₹10,000
- Hostizzy Commission: ₹1,500 (15%)
- Owner's Expected Share: ₹8,500

**Payment Flow:**
- Payment to Owner: ₹10,000 (100% of booking)

**Calculation:**
```
Proportional Commission = (10,000 / 10,000) × 1,500 = ₹1,500

totalToOwner = ₹10,000
commissionFromOwnerPayments = ₹1,500
ownerShareFromHostizzyPayments = ₹0

Net Settlement = ₹0 - ₹1,500 = -₹1,500
```

**Result**: Owner owes ₹1,500 to Hostizzy ✅

**Display**: ⚠️ Payment Pending: ₹1,500

---

### Example 2: Single Booking - 100% Payment to Hostizzy

**Booking Details:**
- Total Amount: ₹10,000
- Hostizzy Commission: ₹1,500 (15%)
- Owner's Expected Share: ₹8,500

**Payment Flow:**
- Payment to Hostizzy: ₹10,000 (100% of booking)

**Calculation:**
```
Proportional Commission = (10,000 / 10,000) × 1,500 = ₹1,500
Owner Share = 10,000 - 1,500 = ₹8,500

totalToHostizzy = ₹10,000
commissionFromOwnerPayments = ₹0
ownerShareFromHostizzyPayments = ₹8,500

Net Settlement = ₹8,500 - ₹0 = +₹8,500
```

**Result**: Hostizzy owes ₹8,500 to Owner ✅

**Display**: ✅ Payout Pending: ₹8,500

---

### Example 3: Single Booking - Split Payment (50/50)

**Booking Details:**
- Total Amount: ₹10,000
- Hostizzy Commission: ₹1,500 (15%)
- Owner's Expected Share: ₹8,500

**Payment Flow:**
- Payment to Owner: ₹5,000 (50% of booking)
- Payment to Hostizzy: ₹5,000 (50% of booking)

**Calculation:**

**From Payment to Owner:**
```
Proportional Commission = (5,000 / 10,000) × 1,500 = ₹750
Owner owes Hostizzy: ₹750
```

**From Payment to Hostizzy:**
```
Proportional Commission = (5,000 / 10,000) × 1,500 = ₹750
Owner Share = 5,000 - 750 = ₹4,250
Hostizzy owes Owner: ₹4,250
```

**Net Settlement:**
```
totalToOwner = ₹5,000
totalToHostizzy = ₹5,000
commissionFromOwnerPayments = ₹750
ownerShareFromHostizzyPayments = ₹4,250

Net Settlement = ₹4,250 - ₹750 = +₹3,500
```

**Result**: Hostizzy owes ₹3,500 to Owner ✅

**Display**: ✅ Payout Pending: ₹3,500

**Verification:**
- Owner received: ₹5,000
- Owner's share from Hostizzy payment: ₹4,250
- Total for owner: ₹9,250
- Commission due: ₹750
- Owner's net: ₹9,250 - ₹750 = ₹8,500 ✅ (Matches expected)

---

### Example 4: Multiple Bookings - Complex Scenario

**Booking A:**
- Total: ₹20,000, Commission: ₹3,000
- Payment to Owner: ₹10,000 (50%)
- Payment to Hostizzy: ₹10,000 (50%)

**Booking B:**
- Total: ₹15,000, Commission: ₹2,250
- Payment to Hostizzy: ₹15,000 (100%)

**Calculation:**

**Booking A - Payment to Owner:**
```
Proportional Commission = (10,000 / 20,000) × 3,000 = ₹1,500
```

**Booking A - Payment to Hostizzy:**
```
Proportional Commission = (10,000 / 20,000) × 3,000 = ₹1,500
Owner Share = 10,000 - 1,500 = ₹8,500
```

**Booking B - Payment to Hostizzy:**
```
Proportional Commission = (15,000 / 15,000) × 2,250 = ₹2,250
Owner Share = 15,000 - 2,250 = ₹12,750
```

**Totals:**
```
totalToOwner = ₹10,000
totalToHostizzy = ₹25,000
commissionFromOwnerPayments = ₹1,500
ownerShareFromHostizzyPayments = ₹8,500 + ₹12,750 = ₹21,250

Net Settlement = ₹21,250 - ₹1,500 = +₹19,750
```

**Result**: Hostizzy owes ₹19,750 to Owner ✅

**Display**: ✅ Payout Pending: ₹19,750

**Verification:**
- Booking A owner's share: ₹17,000 (₹20,000 - ₹3,000)
- Booking B owner's share: ₹12,750 (₹15,000 - ₹2,250)
- Total expected: ₹29,750
- Owner received directly: ₹10,000
- Remaining from Hostizzy: ₹29,750 - ₹10,000 = ₹19,750 ✅

---

## Edge Cases

### Edge Case 1: Partial Payment
**Booking:** ₹10,000 total, ₹1,500 commission
**Payment:** ₹3,000 to Owner (30% of booking)

```
Proportional Commission = (3,000 / 10,000) × 1,500 = ₹450
Net Settlement = ₹0 - ₹450 = -₹450
```
✅ Correctly calculates partial commission

### Edge Case 2: Zero Division Protection
**Code:** `bookingTotal > 0 ? (paymentAmount / bookingTotal) * bookingCommission : 0`

If bookingTotal is 0, proportional commission = 0 ✅

### Edge Case 3: Multiple Payments for Same Booking
Each payment is calculated independently with proportional commission ✅

---

## Settlement Card Display

### Card Components

1. **Header**: Month label + Net Settlement amount
2. **Left Box**:
   - 💰 Payments to You: `totalToOwner`
   - Commission due: `commissionDue`
3. **Right Box**:
   - 🏢 Payments to Hostizzy: `totalToHostizzy`
   - Your share: `ownerShare`
4. **Footer**:
   - Status message (Payout/Payment Pending)
   - Action button (Mark Payout Received / Mark Payment Done)

### Display Logic
```javascript
if (netSettlement >= 0) {
    status = "✅ Payout Pending: ₹{netSettlement}"
    button = "Mark Payout Received"
} else {
    status = "⚠️ Payment Pending: ₹{abs(netSettlement)}"
    button = "Mark Payment Done"
}
```

---

## Conclusion

✅ **Settlement calculation is MATHEMATICALLY CORRECT**

The dual-flow settlement tracking:
1. ✅ Correctly calculates proportional commission based on payment amounts
2. ✅ Properly separates payments by recipient
3. ✅ Accurately computes net settlement
4. ✅ Handles partial payments correctly
5. ✅ Protects against division by zero
6. ✅ Displays correct status and amounts

The formula ensures that regardless of payment flow, the owner's final settlement matches their expected share from all bookings.
