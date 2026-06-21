# FleetFuel System - Test Login Credentials

## 1. Super Admin Access
**Role:** Super Admin - Full system access, manages all clients and garages

**Login Type:** Admin Login (use the Admin Login button)

```
Email: willem@fleetfuel.com
Password: FleetFuel2024!
```

**Capabilities:**
- View and manage all client organizations
- Create and manage all garages
- View all vehicles across all clients
- View all drivers across all clients
- Access consolidated reports
- EFT batch processing

---

## 2. Client Admin Access
**Role:** Client Admin - Manages their own organization only

**Login Type:** Admin Login (use the Admin Login button)

### Option 1: NELMARK TRADING
```
Email: john@fleet.com
Password: Fleet2024!
```

**Organization:** NELMARK TRADING

### Option 2: TEST TRANSPORT SOLUTIONS
```
Email: admin@test-transport.co.za
Password: TestTransport2024!
```

**Organization:** TEST TRANSPORT SOLUTIONS (PTY) LTD

**Capabilities:**
- Search and view all garages in the system
- Add/edit/delete vehicles in their own organization only
- Add/edit/delete drivers in their own organization only
- View own organization's fuel transactions
- View own organization's reports
- Cannot see other clients' data
- Cannot create organizations or manage garages

---

## 3. Driver Access
**Role:** Driver - Mobile fuel purchase app only

**Login Type:** Driver Login (use the Driver Login button)

```
First Name: WILLEM
Date of Birth: 1956-08-22
```

**Organization:** NELMARK TRADING

**Capabilities:**
- Access mobile fuel purchase interface
- Scan license disks and number plates
- Record fuel purchases at garages
- Cannot access any admin features

---

## Testing Workflow

1. **Test Super Admin:**
   - Login with willem@fleetfuel.com
   - Navigate to "Client Organizations" to see all clients
   - Navigate to "Garages" to manage garages
   - Check that you can see vehicles and drivers from all clients

2. **Test Client Admin:**
   - Login with john@fleet.com
   - Try to access "Client Organizations" (should not see this option)
   - Navigate to "Vehicles" - should only see NELMARK TRADING vehicles
   - Navigate to "Drivers" - should only see NELMARK TRADING drivers
   - Navigate to "Garages" - should be able to view/search all garages
   - Try creating a vehicle - should only be able to assign to NELMARK TRADING

3. **Test Driver:**
   - Use "Driver Login" button
   - Enter first name: WILLEM
   - Enter date of birth: 1956-08-22
   - Should see mobile fuel purchase interface only
   - Cannot access any admin features

---

## Notes

- If you need to reset or change passwords, you'll need to use Supabase's password reset functionality
- Driver access uses a separate authentication system (first name + date of birth)
- All data is properly isolated - clients cannot see each other's data
- Super admin has visibility across all clients for management and reporting
