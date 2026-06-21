# Role System Documentation

## Overview

The application has a clear separation between **Management Organization** and **Client Organizations** with distinct role systems.

---

## 1. Management Organization (Fuel Empowerment Systems)

### Purpose
The management organization oversees the entire system and manages client organizations.

### Roles (stored in `profiles.role`)

| Role | Description | Access Level |
|------|-------------|--------------|
| `super_admin` | Full system access | All features, all organizations |
| `admin` | Management administrator | Manage client organizations, system settings |
| `manager` | Management supervisor | View reports, manage specific areas |
| `user` | Standard management user | Limited management access |

### Key Points
- **NO 'driver' role** in management organization
- Management users cannot have driver-level access
- If management org wants vehicles/drivers, they must:
  1. Create a separate Client Organization
  2. Load vehicles and drivers under that client org
  3. This keeps roles separate and clean

### Example
```
Fuel Empowerment Systems (Management Org)
├── John Smith (super_admin) - Full system access
├── Jane Doe (admin) - Manages client accounts
└── Bob Johnson (manager) - Views reports

Fuel Empowerment Systems Fleet (Client Org) - Separate organization
├── John Smith (Main User) - Manages their own fleet
└── Driver Mike (driver) - Drives company vehicles
```

---

## 2. Client Organizations

### Purpose
Organizations that use the system to manage their fleet, drivers, and fuel transactions.

### User Classification (stored in `title` field and boolean flags)

| Title | Boolean Flag | Description | Permissions |
|-------|--------------|-------------|-------------|
| **Main User** | `is_main_user = true` | Primary account owner | Full access - REQUIRED |
| **Secondary Main User** | `is_secondary_main_user = true` | Secondary owner | Full access - Optional |
| **Billing User** | - | Handles invoices and payments | Customizable |
| **Driver User** | - | Manages drivers | Customizable |
| **Vehicle User** | - | Can view/manage vehicles | Customizable |
| **User** | - | Standard access | Customizable |

### CRITICAL: Main User Requirement
- **Every client organization MUST have exactly one Main User**
- The Main User is the primary account holder
- Main User has full control over the organization
- Main User manages organizational integrity and information
- Cannot be deleted or demoted without transferring status to another user

### Granular Permissions
Each user has specific permission flags:
- `can_add_vehicles`
- `can_edit_vehicles`
- `can_delete_vehicles`
- `can_add_drivers`
- `can_edit_drivers`
- `can_delete_drivers`
- `can_view_reports`
- `can_edit_organization_info`
- `can_view_fuel_transactions`
- `can_create_reports`
- `can_view_custom_reports`
- `can_manage_users`
- `can_view_financial_data`

### Driver Access
- Drivers are stored in separate `drivers` table
- Drivers access system ONLY via **Driver Mobile App**
- A driver can ALSO be loaded as an `organization_users` entry for client portal access

### Example Scenario: Private Individual
```
John's Personal Fleet (Client Organization)
├── John (Main User + driver)
    - Main User: Full client portal access to manage organization
    - Also loaded as driver: Can use Driver Mobile App
    - This gives John both management and driver capabilities
```

---

## 3. Database Structure

### profiles table
```sql
- id (uuid) - References auth.users
- organization_id (uuid) - References organizations
- full_name (text)
- role (text) - CHECK: 'super_admin', 'admin', 'manager', 'user'
- Used for: Management org users only
```

### organization_users table
```sql
- id (uuid)
- organization_id (uuid)
- user_id (uuid) - References auth.users
- email (text)
- first_name, surname, title (text)
- is_main_user (boolean) - PRIMARY CLASSIFICATION: Main account holder
- is_secondary_main_user (boolean) - PRIMARY CLASSIFICATION: Secondary main user
- [permission flags...]
- Used for: Client organization users
```

### drivers table
```sql
- id (uuid)
- organization_id (uuid)
- full_name, license_number, etc.
- Used for: Drivers who access via Mobile App
```

---

## 4. Implementation Guidelines

### Creating Management Users
1. Use standard Supabase auth signup
2. Assign role in `profiles.role`: 'super_admin', 'admin', 'manager', or 'user'
3. Set `organization_id` to management org ID

### Creating Client Organization Main User
1. Created automatically during organization signup
2. `is_main_user = true` is set
3. Has full permissions by default
4. This user manages the organization

### Creating Client Organization Users
1. Use the `create-user` edge function
2. Set appropriate `title`: 'Secondary Main User', 'Billing User', 'Driver User', 'Vehicle User', 'User'
3. Configure granular permissions based on their role
4. User gets entry in both `auth.users` and `organization_users`

### Creating Drivers
1. Create entry in `drivers` table
2. Set `organization_id` to client org
3. Driver can only access via Driver Mobile App
4. Optionally: Also create `organization_users` entry for portal access

### Dual Access (Driver + Portal User)
```typescript
// Step 1: Create driver
await supabase.from('drivers').insert({
  organization_id: clientOrgId,
  full_name: 'John Doe',
  license_number: 'ABC123',
  // ... other driver fields
});

// Step 2: Create organization user for portal access
await createUser({
  email: 'john@example.com',
  title: 'User',
  can_view_reports: true,
  // ... permissions
});
```

---

## 5. Security & RLS

- Management org users (via `profiles`) can access all organizations
- Client org users can only access their own organization
- Main User has full control over their organization
- Drivers have very limited access (vehicle status, fuel purchases)
- Super admins bypass all restrictions
- All tables have Row Level Security enabled

---

## 6. Frontend Component Guidelines

### For Management Organization Users
- Show role dropdown: 'super_admin', 'admin', 'manager', 'user'
- Use `profiles` table
- Access: SuperAdminDashboard component

### For Client Organization Users
- Show title dropdown: 'Main User', 'Secondary Main User', 'Billing User', 'Driver User', 'Vehicle User', 'User'
- Show granular permission checkboxes
- Use `organization_users` table
- Access: ClientDashboard component
- **Always ensure one Main User exists**

### For Drivers
- No complex role selection
- Simple driver registration form
- Use `drivers` table
- Access: DriverMobileApp component

---

## 7. Migration Path

If management org wants to use the system for their own fleet:

1. Create new Client Organization: "Fuel Empowerment Fleet"
2. Designate a Main User for this organization
3. Load vehicles under this client org
4. Load drivers under this client org
5. Management users can still access via super_admin role
6. Keeps separation between management role and client role

This ensures:
- Clean role separation
- No role confusion
- Proper permissions and access control
- Clear audit trails
- Every client organization has a responsible Main User

---

## 8. Key Differences Summary

| Aspect | Management Org | Client Org |
|--------|---------------|------------|
| **Primary Table** | `profiles` | `organization_users` |
| **Role Field** | `profiles.role` | `title` + boolean flags |
| **Available Roles** | super_admin, admin, manager, user | Main User, Secondary Main User, Billing User, Driver User, Vehicle User, User |
| **Driver Role** | NOT allowed | Separate `drivers` table |
| **Main User** | Not applicable | REQUIRED - exactly one |
| **Purpose** | System management | Fleet management |
| **Access Scope** | All organizations | Own organization only |
| **Reporting/Filtering** | Use role field | Use title field |
