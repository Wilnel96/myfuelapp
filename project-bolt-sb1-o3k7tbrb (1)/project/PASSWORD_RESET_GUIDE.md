# Password Reset Guide

## How to Reset Your Password

### Option 1: Using the Password Reset Page (Recommended)

1. Go to the login page and click "Forgot Password?" link
2. Enter your email address (e.g., `admin@test-transport.co.za`)
3. Enter your new password (minimum 6 characters)
4. Confirm your new password
5. Click "Reset Password"
6. You can now log in with your new password

This works for all users, including test accounts with fake email addresses.

### Option 2: Direct Access

Navigate directly to the password reset component in the app:
- The password reset feature is accessible from the System Admin login page
- Look for the "Forgot Password?" link below the Sign In button

## Security Features

- No email verification required (perfect for testing and fake email addresses)
- Minimum password length: 6 characters
- Password updates are applied to both:
  - Supabase Auth (for authentication)
  - organization_users table (for internal records)

## For Administrators

The password reset function (`update-user-password`) supports two modes:

1. **Public Mode** (no authentication required):
   - Provide `email` and `newPassword`
   - Anyone can reset any user's password using their email
   - Perfect for testing and password recovery

2. **Authenticated Mode** (requires authorization):
   - Provide `user_id` and `new_password`
   - Requires main user or user management permissions
   - Used internally by administrators

## Technical Details

- Edge Function: `update-user-password`
- Accepts both `newPassword` and `new_password` parameter names
- Returns JSON with `success` and `message` fields
- Automatically updates both auth.users and organization_users tables
