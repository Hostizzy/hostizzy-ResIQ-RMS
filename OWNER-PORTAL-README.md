# 🏠 Owner Portal - ResIQ by Hostizzy

A comprehensive portal for property owners to manage their revenue, track bookings, request payouts, and view analytics.

---

## 📋 Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [API Integration](#api-integration)
- [Security](#security)

---

## ✨ Features

### 1. **Revenue Dashboard**
- 💰 Total revenue tracking
- 💼 Hostizzy commission calculation
- ✨ Net earnings display
- ⏳ Pending payout tracker
- 📊 Interactive revenue charts (7, 30, 90 days)
- 📈 Revenue breakdown visualization

### 2. **Bookings Management**
- 📅 Complete booking history
- 🔍 Filter by status (Confirmed, Checked-in, Completed)
- 👤 Guest information display
- 💵 Booking amount tracking
- 📊 Property-wise filtering

### 3. **Payment Collections**
- 💳 All payment transactions
- 📅 Payment dates and methods
- 💰 Owner share calculation (80% by default)
- 🔍 Property-wise payment filtering
- 📊 Payment history overview

### 4. **Payout System**
- 💸 Request payout functionality
- 📋 Payout history tracking
- ⏱️ Status monitoring (Pending, Approved, Processing, Completed, Rejected)
- 💵 Minimum payout: ₹100
- 🏦 Multiple payment methods (Bank Transfer, UPI)

### 5. **Bank Account Management**
- 🏦 Save bank account details
- 💳 Primary account designation
- 📝 UPI ID support
- 🔒 Secure storage
- ✏️ Easy updates

### 6. **Multi-Property Support**
- 🏘️ Manage multiple properties
- 🔄 Switch between properties
- 📊 Combined or individual analytics
- 💰 Property-specific revenue tracking

---

## 🚀 Setup Instructions

### Step 1: Database Setup

Run the SQL schema to create required tables:

```bash
psql -U your_user -d your_database -f database/owner-portal-schema.sql
```

Or in Supabase Dashboard:
1. Go to **SQL Editor**
2. Copy contents of `database/owner-portal-schema.sql`
3. Click **Run**

### Step 2: Configure Supabase

Update `owner-portal.html` with your Supabase credentials:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key-here';
```

### Step 3: Create Owner Accounts

Insert owner records into the database:

```sql
INSERT INTO property_owners (name, email, phone) VALUES
('John Doe', 'john@example.com', '+91-9876543210');
```

### Step 4: Link Properties to Owners

Update existing properties:

```sql
UPDATE properties
SET owner_id = (SELECT id FROM property_owners WHERE email = 'john@example.com')
WHERE name = 'Your Property Name';
```

### Step 5: Link Reservations to Owners

```sql
UPDATE reservations r
SET owner_id = p.owner_id
FROM properties p
WHERE r.property_id = p.id;
```

### Step 6: Deploy

Upload `owner-portal.html` to your web server or hosting platform:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop to Netlify Dashboard
- **GitHub Pages**: Push to gh-pages branch

---

## 🗄️ Database Schema

### Tables Created

#### 1. **property_owners**
Stores owner information and credentials.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(200) | Owner name |
| email | VARCHAR(255) | Login email (unique) |
| phone | VARCHAR(20) | Contact number |
| password_hash | TEXT | Encrypted password |
| created_at | TIMESTAMP | Account creation date |

#### 2. **payout_requests**
Tracks all payout requests from owners.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| owner_id | UUID | Foreign key to owners |
| property_id | UUID | Related property (optional) |
| amount | DECIMAL(10,2) | Payout amount |
| status | VARCHAR(20) | pending/approved/completed/rejected |
| payment_method | VARCHAR(50) | bank/upi |
| request_date | TIMESTAMP | When requested |
| approved_by | UUID | Admin who approved |
| transaction_id | VARCHAR(100) | Bank transaction ID |
| notes | TEXT | Additional notes |

#### 3. **owner_bank_accounts**
Stores bank account details for payouts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| owner_id | UUID | Foreign key to owners |
| account_holder_name | VARCHAR(200) | Account name |
| account_number | VARCHAR(50) | Bank account number |
| ifsc_code | VARCHAR(20) | Bank IFSC code |
| bank_name | VARCHAR(100) | Bank name |
| branch | VARCHAR(100) | Branch name |
| upi_id | VARCHAR(100) | UPI ID |
| is_primary | BOOLEAN | Primary account flag |
| is_verified | BOOLEAN | Verification status |

### Views Created

#### owner_revenue_summary
Aggregates owner revenue data:
- Total bookings
- Total revenue
- Commission amount
- Net earnings
- Paid vs pending earnings

#### owner_available_payouts
Calculates available balance for payouts:
- Total earnings
- Requested amounts
- Available balance

---

## ⚙️ Configuration

### Commission Settings

Default commission is 20% to Hostizzy, 80% to owner. To customize:

```sql
-- Update property commission rate
UPDATE properties
SET commission_percentage = 25.00 -- 25% commission
WHERE id = 'property-uuid';

-- Update globally in trigger function
-- Edit calculate_owner_earnings() in schema.sql
```

### Payout Settings

Minimum payout amount is ₹100. To change:

```javascript
// In owner-portal.html, line ~1790
if (amount < 500) { // Change to ₹500
    alert('Minimum payout amount is ₹500');
    return;
}
```

### Email Notifications

To add email notifications for payout requests, integrate with:
- SendGrid
- AWS SES
- Resend

Example integration point (add to `submitPayoutRequest` function):

```javascript
// After successful payout request
await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer YOUR_SENDGRID_KEY',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        to: 'admin@hostizzy.com',
        subject: 'New Payout Request',
        text: `Owner ${currentOwner.name} requested ₹${amount}`
    })
});
```

---

## 📖 Usage Guide

### For Property Owners

#### 1. **Login**
- Navigate to `owner-portal.html`
- Enter your registered email and password
- Click "Login to Dashboard"

#### 2. **View Revenue**
- Dashboard shows your total revenue, commission, and net earnings
- View charts for revenue trends
- Filter by property using the dropdown

#### 3. **Check Bookings**
- Click "📅 Bookings" tab
- View all your property bookings
- Filter by status (Confirmed, Checked-in, Completed)

#### 4. **Review Payments**
- Click "💳 Payments" tab
- See all payment collections
- View your share (80%) for each payment

#### 5. **Request Payout**
- Click "💸 Payouts" tab
- Click "Request Payout" button
- Enter amount (minimum ₹100)
- Select payment method
- Submit request

#### 6. **Manage Bank Details**
- Click "🏦 Bank Details" tab
- Fill in your bank account information
- Add UPI ID (optional)
- Save details

### For Administrators

#### 1. **Approve Payouts**
Run in admin dashboard or SQL:

```sql
UPDATE payout_requests
SET status = 'approved',
    approved_by = 'admin-uuid',
    approval_date = NOW()
WHERE id = 'payout-request-uuid';
```

#### 2. **Complete Payouts**
After processing payment:

```sql
UPDATE payout_requests
SET status = 'completed',
    transaction_id = 'TXN123456',
    completed_date = NOW()
WHERE id = 'payout-request-uuid';
```

#### 3. **Reject Payouts**

```sql
UPDATE payout_requests
SET status = 'rejected',
    rejection_reason = 'Insufficient balance'
WHERE id = 'payout-request-uuid';
```

---

## 🔗 API Integration

### Admin Endpoints Needed

You may want to create these API endpoints in your admin panel:

#### 1. **GET /api/owner/payouts**
Returns all pending payout requests

#### 2. **POST /api/owner/payouts/:id/approve**
Approve a payout request

#### 3. **POST /api/owner/payouts/:id/complete**
Mark payout as completed with transaction ID

#### 4. **POST /api/owner/payouts/:id/reject**
Reject a payout request with reason

---

## 🔒 Security

### Authentication

Currently using basic email authentication. Recommended improvements:

1. **Add Password Hashing**:
```javascript
// Use bcrypt or similar
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 10);
```

2. **Implement JWT Tokens**:
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ ownerId: owner.id }, SECRET_KEY);
```

3. **Add Session Management**:
```javascript
// Store token in localStorage
localStorage.setItem('ownerToken', token);
```

4. **Enable Row Level Security (RLS)** in Supabase:
```sql
-- Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can only see their own data
CREATE POLICY "Owners see own payouts"
ON payout_requests
FOR SELECT
USING (auth.uid() = owner_id);
```

### Best Practices

- ✅ Use HTTPS only
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ✅ Sanitize SQL queries (use parameterized queries)
- ✅ Enable CORS restrictions
- ✅ Add two-factor authentication (2FA)
- ✅ Log all payout activities
- ✅ Require email verification for bank changes

---

## 📊 Analytics & Reporting

### Custom Reports

Query examples for additional reporting:

#### Monthly Revenue by Owner
```sql
SELECT
    po.name AS owner_name,
    DATE_TRUNC('month', r.check_in) AS month,
    COUNT(*) AS bookings,
    SUM(r.total_amount) AS revenue,
    SUM(r.owner_earnings) AS earnings
FROM reservations r
JOIN property_owners po ON r.owner_id = po.id
WHERE r.status = 'checked-out'
GROUP BY po.name, DATE_TRUNC('month', r.check_in)
ORDER BY month DESC;
```

#### Top Earning Properties
```sql
SELECT
    p.name AS property_name,
    po.name AS owner_name,
    SUM(r.owner_earnings) AS total_earnings
FROM reservations r
JOIN properties p ON r.property_id = p.id
JOIN property_owners po ON r.owner_id = po.id
GROUP BY p.name, po.name
ORDER BY total_earnings DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Invalid credentials" on login**
- Check if owner exists in `property_owners` table
- Verify email is correct
- Check Supabase connection

**2. "No bookings found"**
- Ensure `reservations` have `owner_id` set
- Run the link query from Step 5 in setup

**3. Charts not displaying**
- Verify Chart.js is loaded
- Check browser console for errors
- Ensure data is being returned from Supabase

**4. Payout request fails**
- Check minimum amount (₹100)
- Verify bank details are saved
- Check Supabase permissions

---

## 🚀 Future Enhancements

Planned features:
- [ ] Email notifications for payout status
- [ ] SMS alerts for important updates
- [ ] PDF statement generation
- [ ] Tax calculation and reports
- [ ] Multi-currency support
- [ ] Automated payout scheduling
- [ ] Mobile app (React Native)
- [ ] WhatsApp integration
- [ ] Advanced analytics dashboard
- [ ] Property performance comparison

---

## 📞 Support

For issues or questions:
- Email: support@hostizzy.com
- Documentation: [docs.hostizzy.com](https://docs.hostizzy.com)
- GitHub Issues: [github.com/hostizzy/resiq/issues](https://github.com/hostizzy/resiq/issues)

---

## 📄 License

Copyright © 2025 Hostizzy. All rights reserved.

---

**Built with ❤️ by Hostizzy Team**
