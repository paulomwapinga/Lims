# Remtullah Medical Laboratory Management System
## Complete User Guide

---

## TABLE OF CONTENTS

1. [Getting Started](#getting-started)
2. [Login & Authentication](#login--authentication)
3. [Dashboard Overview](#dashboard-overview)
4. [Patient Management](#patient-management)
5. [Visit Management](#visit-management)
6. [Laboratory Testing](#laboratory-testing)
7. [Inventory Management](#inventory-management)
8. [Purchase Management](#purchase-management)
9. [User Management](#user-management)
10. [Communication & SMS](#communication--sms)
11. [Reports](#reports)
12. [Settings](#settings)
13. [Troubleshooting](#troubleshooting)

---

## GETTING STARTED

### System Access
The system is web-based and can be accessed from any device with an internet browser:
- **Recommended Browsers:** Chrome, Firefox, Safari, Edge (latest versions)
- **Minimum Internet Speed:** 3G connection
- **Screen Resolution:** 1024x768 or higher

### First Time Login
1. Open your web browser
2. Navigate to your system URL
3. You will be provided with login credentials by your administrator
4. Change your password after first login (recommended)

---

## LOGIN & AUTHENTICATION

### How to Login
1. Enter your **email address**
2. Enter your **password**
3. Click **"Sign In"** button

### Forgot Password
1. Click **"Forgot Password?"** link on login page
2. Enter your registered email address
3. Check your email for password reset link
4. Click the link and set a new password

### Security Tips
- Never share your login credentials
- Use a strong password (mix of letters, numbers, symbols)
- Log out when leaving your workstation
- Change your password regularly

---

## DASHBOARD OVERVIEW

### Dashboard Statistics
When you log in, you'll see key metrics at the top:

- **Today's Visits** - Number of patient visits today
- **Total Patients** - Total patients registered in system
- **Low Stock Items** - Items below reorder level
- **Today's Revenue** - Total income for today

### Lab Test Status Widgets
- **Pending Tests** - Tests ordered but not started
- **In Progress** - Tests currently being processed
- **Completed Today** - Tests finished today

### Revenue Chart
- Visual graph showing last 7 days revenue trend
- Helps track daily income patterns

### Navigation Menu
Located on the left side, showing different modules based on your role:
- Dashboard
- Patients
- Visits
- Tests (Lab Results)
- Inventory
- Purchases
- Reports
- Users (Admin only)
- Communication
- Settings

### Notification Bell
Located in the top-right corner:
- Shows number of unread notifications
- Click to see notification dropdown
- New lab results and system alerts appear here
- Audio beep for new notifications

---

## PATIENT MANAGEMENT

### Adding a New Patient

1. Click **"Patients"** in the left menu
2. Click **"+ Add Patient"** button
3. Fill in patient information:
   - **Name** (required)
   - **Phone Number** (for SMS notifications)
   - **Gender** (Male/Female)
   - **Age** and **Age Unit** (Years/Months)
   - **Date of Birth** (optional if age is entered)
   - **Marital Status** (Single/Married/Divorced/Widowed/Separated)
   - **Address**
4. Click **"Save"** button

### Searching for Patients

**Search Box:**
- Type patient name or phone number
- Results filter automatically as you type

**Pagination:**
- Use "Previous" and "Next" buttons to navigate
- Shows 10 patients per page

### Viewing Patient Details

1. Find the patient in the list
2. Click the **Eye icon** (👁️) to view details
3. See patient information and visit history

### Editing Patient Information

1. Find the patient in the list
2. Click the **Edit icon** (✏️)
3. Update the information
4. Click **"Save"** to update

### Deleting a Patient

1. Find the patient in the list
2. Click the **Delete icon** (🗑️)
3. Confirm deletion
4. **Note:** Only admins can delete patients with no visits

---

## VISIT MANAGEMENT

### Creating a New Visit

1. Click **"Visits"** in the left menu
2. Click **"+ New Visit"** button
3. **Select Patient:**
   - Search and select from existing patients
   - Or click "Add New Patient" to register a new one
4. **Select Doctor:** Choose the attending doctor
5. **Add Tests:**
   - Click "+ Add Test"
   - Select test from dropdown
   - Quantity auto-fills (usually 1)
   - Price auto-fills from test price
   - Click "Add" to include in visit
   - Repeat to add multiple tests
6. **Add Medicines (optional):**
   - Click "+ Add Medicine"
   - Select medicine from dropdown
   - Enter quantity
   - Enter instructions (e.g., "2 tablets twice daily")
   - Price auto-fills
   - Click "Add" to include
7. **Enter Diagnosis:** Add clinical findings
8. **Enter Notes:** Additional observations
9. **Payment:**
   - Subtotal calculates automatically
   - Enter amount paid
   - Balance auto-calculates
   - Payment status updates automatically:
     - Paid (balance = 0)
     - Partial (0 < balance < total)
     - Unpaid (balance = total)
10. Click **"Save Visit"** button

### Viewing Visit History

1. Click **"Visit History"** in left menu
2. See all past visits with:
   - Patient name
   - Doctor name
   - Visit date
   - Total amount
   - Paid amount
   - Balance
   - Payment status

### Filtering Visits

**Search Box:**
- Type patient name, doctor name, or diagnosis
- Results filter in real-time

**Date Range Filter:**
- Select "From" date
- Select "To" date
- Click "Apply Filter"

### Printing Receipt

1. Open a visit (view or after creation)
2. Click **"Print Receipt"** button
3. Browser print dialog opens
4. Select printer or "Save as PDF"
5. Print or save

**Receipt Includes:**
- Clinic information
- Patient details
- Visit date and time
- List of tests and medicines
- Subtotal, paid, and balance
- Payment status

### Editing a Visit

1. Find the visit in Visit History
2. Click the **Edit icon**
3. Modify visit details
4. Click **"Save Changes"**
5. **Note:** Completed test results may prevent editing

### Deleting a Visit

1. Find the visit in Visit History
2. Click the **Delete icon**
3. Confirm deletion
4. **Note:** Only admins can delete visits

---

## LABORATORY TESTING

### Understanding Test Workflow

Tests go through three stages:

1. **Pending** - Doctor has ordered the test
2. **In Progress** - Lab tech is entering results
3. **Completed** - Results are final and sent to doctor

### For Lab Technicians: Entering Test Results

#### Step 1: Access Lab Results
1. Click **"Lab Results"** in left menu
2. Click **"Enter Results"** tab
3. See list of pending and in-progress tests

#### Step 2: Start Entering Results
1. Click **"Enter Results"** button for a test
2. System opens result entry form

#### Step 3: Fill in Results
For each test parameter, you'll see:

**Numeric Parameters:**
- Enter the numerical value
- Reference range shown (e.g., 4.0 - 10.0)
- System auto-detects if abnormal (H = High, L = Low)

**Qualitative Parameters:**
- Select from dropdown options
- Examples: Clear, Cloudy, Yellow, Red
- System auto-detects abnormality based on rules

**Boolean Parameters:**
- Select Positive or Negative
- Used for presence/absence tests

**Visual Indicators:**
- ⚠️ Red background = Abnormal result
- Green background = Normal result
- H flag = Higher than normal
- L flag = Lower than normal

#### Step 4: Add Notes (Optional)
- Enter technician observations
- Document any issues or comments

#### Step 5: Save Results
Two options:
- **"Save Progress"** - Saves but keeps status as "In Progress"
- **"Save & Complete"** - Marks test as completed

#### Step 6: Send to Doctor
1. After completing results, click **"Send to Doctor"**
2. Doctor receives notification
3. SMS sent to patient (if enabled)
4. Test moves to "Completed" tab

### For Doctors: Viewing Test Results

#### Step 1: Access Results
1. Click **"Lab Results"** in left menu
2. Click **"View Results"** tab
3. See tests sent to you by lab techs

#### Step 2: Review Results
1. Click **"View Results"** button
2. See complete test report with:
   - Patient information
   - All parameters and values
   - Reference ranges
   - Abnormal flags (H/L)
   - Lab technician notes

#### Step 3: Acknowledge Results
1. After reviewing, results are marked as "viewed"
2. Use for clinical decision making
3. Print report if needed

### Printing Lab Results

1. Open test results (as doctor or admin)
2. Click **"Print Results"** button
3. Professional lab report opens:
   - Clinic header with logo
   - Patient demographics
   - Test name and parameters
   - All results with reference ranges
   - Abnormal results highlighted
   - Lab technician signature
   - Doctor signature area
   - Report timestamp
4. Print or save as PDF

### Test Status Colors

- 🟡 **Yellow badge** = Pending
- 🔵 **Blue badge** = In Progress
- 🟢 **Green badge** = Completed

---

## INVENTORY MANAGEMENT

### Understanding Inventory

The system tracks two types of items:
1. **Medicines** - Pharmaceutical products for sale
2. **Lab Consumables** - Testing supplies and reagents

### Viewing Inventory

1. Click **"Inventory"** in left menu
2. See all inventory items with:
   - Item name
   - Type (Medicine/Lab Consumable)
   - Unit of measure
   - Quantity on hand
   - Reorder level
   - Cost price
   - Selling price

### Low Stock Alerts

- Dashboard shows count of low stock items
- Items below reorder level highlighted in red
- Click "Low Stock Items" to see filtered list

### Adding New Inventory Item

1. Click **"+ Add Item"** button
2. Fill in information:
   - **Name** (required, must be unique)
   - **Type** (Medicine or Lab Consumable)
   - **Unit** (tablets, bottles, strips, ml, etc.)
   - **Quantity on Hand** (starting quantity)
   - **Reorder Level** (minimum stock alert level)
   - **Cost Price** (purchase price per unit)
   - **Sell Price** (selling price per unit)
3. Click **"Save"** button

### Editing Inventory Item

1. Find the item in the list
2. Click the **Edit icon**
3. Update information
4. Click **"Save"**

**Note:** Quantity changes should be done through purchases or adjustments, not by editing directly.

### Deleting Inventory Item

1. Find the item in the list
2. Click the **Delete icon**
3. Confirm deletion
4. **Note:** Cannot delete items with existing stock movements

### Stock Movements

Every stock change is logged automatically:

**Movement Types:**
- **IN** - Stock increases (from purchases)
- **OUT** - Stock decreases (from sales, test consumption)
- **ADJUST** - Manual corrections

**Viewing Stock Movements:**
1. Click on an inventory item
2. See "Stock Movement History" section
3. Each movement shows:
   - Date and time
   - Movement type (IN/OUT/ADJUST)
   - Quantity changed
   - Reason
   - Performed by (user)
   - Reference (linked visit or purchase)

### Automatic Stock Deductions

Stock reduces automatically when:
- A visit with medicines is saved (medicines deducted)
- A lab test is completed (consumables deducted per BOM)

This ensures real-time inventory accuracy.

---

## PURCHASE MANAGEMENT

### Creating a Purchase Order

1. Click **"Purchases"** in left menu
2. Click **"+ New Purchase"** button
3. **Enter Purchase Details:**
   - **Supplier Name** (required)
   - **Purchase Date** (defaults to today)
   - **Notes** (optional - invoice number, terms, etc.)
4. **Add Items:**
   - Click "+ Add Item"
   - Select item from dropdown
   - Enter quantity
   - Enter unit price
   - Unit auto-fills from item
   - Total calculates automatically
   - Click "Add Item"
   - Repeat for multiple items
5. **Total Amount** calculates automatically
6. **Save Options:**
   - **"Save as Draft"** - Saves but doesn't affect inventory
   - **"Complete Purchase"** - Saves and updates inventory

### Understanding Draft vs Completed

**Draft Purchase:**
- Purchase is saved but not finalized
- Inventory NOT updated
- Can be edited or deleted
- Useful for getting approvals before finalizing

**Completed Purchase:**
- Purchase is finalized
- Inventory quantities INCREASED immediately
- Stock movements created automatically
- Cannot be edited (only deleted by admin)

### Viewing Purchase History

1. Click **"Purchases"** in left menu
2. See all purchases with:
   - Purchase date
   - Supplier name
   - Total amount
   - Status (Draft/Completed)
   - Created by user

### Filtering Purchases

**Search Box:**
- Type supplier name or notes
- Results filter automatically

**Status Filter:**
- Select "All", "Draft", or "Completed"
- See filtered list

### Completing a Draft Purchase

1. Find the draft purchase
2. Click **"Complete"** button
3. Confirm to update inventory
4. Inventory increases immediately

### Editing a Purchase

1. Find the purchase
2. Click the **Edit icon**
3. Modify details or items
4. Click **"Save"**

**Note:** Only draft purchases can be edited. Completed purchases cannot be edited.

### Deleting a Purchase

1. Find the purchase
2. Click the **Delete icon**
3. Confirm deletion
4. **If Completed:** Inventory is reversed (quantities reduced)
5. **Note:** Only admins can delete completed purchases

---

## USER MANAGEMENT

### User Roles

**Admin:**
- Full system access
- Can manage users
- Can configure settings
- Can delete records
- Financial reports access

**Doctor:**
- Patient registration
- Visit creation
- Test ordering
- Result viewing
- Medicine prescription
- SMS sending

**Lab Technician:**
- Lab result entry
- Test status updates
- Result sending to doctors
- Limited system access

### Adding a New User (Admin Only)

1. Click **"Users"** in left menu
2. Click **"+ Add User"** button
3. Fill in information:
   - **Full Name** (required)
   - **Email Address** (required, unique, used for login)
   - **Password** (required, minimum 6 characters)
   - **Role** (Admin/Doctor/Lab Technician)
4. Click **"Create User"** button
5. User can now log in with email and password

### Editing User Information

1. Find the user in the list
2. Click the **Edit icon**
3. Update information:
   - Name
   - Role
   - Reset password (if needed)
4. Click **"Save"** button

### Deactivating a User

1. Find the user in the list
2. Click the **Delete icon**
3. Confirm deactivation
4. User can no longer log in

**Note:** Cannot delete users with associated records (visits, results, etc.)

### Changing Your Own Password

1. Click **"Settings"** in left menu
2. Click **"Change Password"** (if available)
3. Or contact your administrator to reset

---

## COMMUNICATION & SMS

### SMS Configuration (Admin Only)

#### Step 1: Get Beem Africa Credentials
1. Sign up at [https://beem.africa](https://beem.africa)
2. Get your:
   - API Key
   - Secret Key
   - Source Address (Sender ID)

#### Step 2: Configure in System
1. Click **"Settings"** in left menu
2. Scroll to **"SMS Configuration"** section
3. Enter:
   - API Key
   - Secret Key
   - Source Address
4. Check **"Enable SMS Notifications"**
5. Click **"Save Settings"**

### SMS Notification Types

**1. Welcome SMS**
- Sent automatically when new patient registers
- Template: "Karibu [PATIENT_NAME]! Tunakushukuru kwa kuchagua [CLINIC_NAME]..."
- Can be enabled/disabled in settings

**2. Lab Result Ready SMS**
- Sent automatically when test results completed
- Template: "Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara."
- Can be enabled/disabled in settings

**3. Send to Doctor SMS (Internal)**
- Notification to doctor when lab tech sends results
- System generated, not SMS to phone

### Customizing SMS Templates

1. Go to **"Settings"**
2. Find SMS template sections
3. Edit the message text
4. Use placeholders:
   - `[PATIENT_NAME]` - Patient's name
   - `[CLINIC_NAME]` - Your clinic name
   - `[TEST_NAME]` - Name of completed test
5. Click **"Save Settings"**

### Enabling/Disabling SMS

**Disable Welcome SMS:**
1. Go to Settings
2. Uncheck "Send welcome SMS to new patients"
3. Save Settings

**Disable Lab Result SMS:**
1. Go to Settings
2. Uncheck "Send SMS when lab results ready"
3. Save Settings

**Disable SMS Completely:**
1. Go to Settings
2. Uncheck "Enable SMS Notifications"
3. Save Settings

### Viewing SMS Logs

1. Click **"Communication"** in left menu
2. See SMS log table with:
   - Recipient phone number
   - Message sent
   - Status (Pending/Sent/Failed)
   - Sent date and time
   - SMS type

### Manual SMS Sending (Planned Feature)

Future versions will include:
- Bulk SMS campaigns
- Custom SMS to selected patients
- SMS templates library
- Scheduled SMS sending

---

## REPORTS

### Financial Reports

#### Daily Revenue Report
1. Click **"Reports"** in left menu
2. See today's revenue summary
3. Total collected today displayed

#### Revenue by Date Range
1. Select **"From Date"**
2. Select **"To Date"**
3. Click **"Generate Report"**
4. See total revenue for period

#### Outstanding Balances
1. View list of visits with unpaid balances
2. See patient names and amounts owed
3. Filter by date or patient

### Operational Reports

#### Test Volume
1. See number of tests performed by type
2. Filter by date range
3. Identify most common tests

#### Lab Productivity
1. See tests completed per day/week/month
2. Track turnaround times
3. Monitor pending test backlog

#### Inventory Reports
1. Current stock levels
2. Stock movements by item
3. Low stock items list
4. Inventory valuation

### Exporting Reports

1. Generate desired report
2. Click **"Export"** or **"Print"** button
3. Choose PDF or Excel format
4. Save to computer

---

## SETTINGS

### Clinic Information

1. Click **"Settings"** in left menu
2. Update:
   - **Clinic Name**
   - **Address**
   - **Phone Number**
   - **Receipt Footer** (thank you message)
3. Click **"Save Settings"**

These appear on:
- Receipts
- Lab result reports
- SMS messages

### Logo and Signature Upload

**Upload Logo:**
1. Go to Settings
2. Click "Upload Logo" button
3. Select image file (PNG, JPG)
4. Logo appears on reports and receipts

**Upload Signature:**
1. Go to Settings
2. Click "Upload Signature" button
3. Select signature image
4. Signature appears on lab result reports

### Test Configuration

#### Adding a New Test
1. Click **"Tests"** in left menu
2. Click **"+ Add Test"** button
3. Enter:
   - Test name (unique)
   - Price
   - Notes/Description
4. Click **"Save"**

#### Adding Test Parameters
1. Open test configuration
2. Click **"Add Parameter"**
3. Fill in:
   - Parameter name
   - Parameter type (Numeric/Qualitative/Boolean)
   - Reference range (for numeric)
   - Unit (e.g., cells/μL, g/dL)
   - Applicable to: Male/Female/Child
   - Sort order (display order)
4. For qualitative: Add allowed values (JSON array)
5. Click **"Save"**

#### Linking Consumables to Tests
1. Open test configuration
2. Click **"Add Consumable"**
3. Select consumable item
4. Enter quantity consumed per test
5. Click **"Add"**

Now when test is completed, consumables deduct automatically.

#### Test Interpretation Rules
1. Open test parameter
2. Click **"Add Rule"**
3. Configure rule:
   - Rule type (numeric comparison, text match, range, presence)
   - Operator (>, <, =, between, contains, etc.)
   - Value to compare
   - Result status (normal/abnormal/critical)
   - Priority (order of evaluation)
4. Click **"Save"**

Rules help system auto-detect abnormalities in qualitative results.

### Units Management

1. Go to Settings
2. Click **"Units"** tab
3. See list of available units (tablets, ml, strips, etc.)
4. Add new unit:
   - Click **"+ Add Unit"**
   - Enter unit name
   - Enter description
   - Click **"Save"**

Units standardize measurements across inventory and prescriptions.

---

## TROUBLESHOOTING

### Common Issues

#### Cannot Login
**Solution:**
- Check email and password are correct
- Ensure Caps Lock is off
- Contact administrator to reset password
- Clear browser cache and cookies

#### Test Results Not Saving
**Solution:**
- Check all required fields are filled
- Ensure internet connection is stable
- Refresh page and try again
- Contact administrator if issue persists

#### SMS Not Sending
**Solution:**
- Verify SMS is enabled in settings
- Check API credentials are correct
- Ensure patient has valid phone number
- Check SMS balance with provider
- Review SMS logs for error messages

#### Low Stock Alert Not Showing
**Solution:**
- Check reorder level is set for item
- Verify quantity is actually below reorder level
- Refresh dashboard page
- Check item is not deleted

#### Receipt/Report Not Printing
**Solution:**
- Check browser allows popups
- Ensure printer is connected
- Try "Save as PDF" option
- Check print layout in preview

#### Cannot Delete Patient/Visit
**Solution:**
- Check if record has associated data
- Only admins can delete certain records
- Some records cannot be deleted to maintain data integrity
- Contact administrator for assistance

#### Slow Performance
**Solution:**
- Check internet connection speed
- Clear browser cache
- Close unnecessary browser tabs
- Restart browser
- Contact administrator if consistently slow

### Getting Help

#### In-App Support
- Look for Help icon (?) in relevant pages
- Hover over field labels for tooltips
- Check notification messages for guidance

#### Contact Administrator
- For user account issues
- For system configuration questions
- For data corrections
- For access permission requests

#### Technical Support
- Email: support@yourdomain.com
- Phone: +255-XXX-XXX-XXX
- Business Hours: Monday-Friday, 8am-5pm

---

## BEST PRACTICES

### Data Entry
- Enter complete patient information for better records
- Use consistent naming conventions
- Add notes and observations for future reference
- Double-check critical values before saving

### Security
- Log out when leaving workstation
- Don't share passwords
- Use strong passwords
- Change passwords regularly
- Lock screen when away briefly

### Workflow
- Review pending tests regularly
- Complete lab results promptly
- Send results to doctors immediately
- Print receipts for all visits
- Monitor inventory levels daily

### Financial Management
- Record all payments accurately
- Print receipts for patients
- Review outstanding balances weekly
- Generate financial reports monthly

### System Maintenance
- Keep browser updated
- Clear cache periodically
- Report issues immediately
- Attend training sessions
- Read system announcements

---

## KEYBOARD SHORTCUTS

- **Tab** - Move to next field
- **Shift + Tab** - Move to previous field
- **Enter** - Submit form (when in text field)
- **Esc** - Close modal/dialog
- **Ctrl + P** - Print (when on printable page)
- **Ctrl + F** - Search on page

---

## FREQUENTLY ASKED QUESTIONS

**Q: Can I access the system from my phone?**
A: Yes, the system is responsive and works on smartphones and tablets through a web browser.

**Q: How do I add a new test type?**
A: Admins can add tests through Settings > Tests. Configure parameters and pricing.

**Q: What happens if internet goes down?**
A: The system requires internet connection. Work will resume when connection is restored. Offline mode is planned for future.

**Q: Can I export patient data?**
A: Yes, reports can be exported to PDF and Excel formats.

**Q: How is patient data protected?**
A: All data is encrypted, access is role-based, and system complies with healthcare data standards.

**Q: Can I customize receipt layout?**
A: Clinic information and footer can be customized in Settings. Layout modifications require administrator assistance.

**Q: How do I train new staff?**
A: Provide this user guide, conduct hands-on training, use demo data for practice.

**Q: What if I make a mistake?**
A: Most entries can be edited. Admins can help correct critical errors. System maintains audit trail.

**Q: How much SMS credit do I need?**
A: Depends on patient volume. Estimate: 1 SMS per patient visit (result notification) plus welcome SMS for new patients.

**Q: Can I integrate with other systems?**
A: Contact technical support for integration possibilities with lab equipment, payment gateways, or health information systems.

---

## APPENDIX

### Glossary of Terms

- **RLS** - Row Level Security (database security feature)
- **BOM** - Bill of Materials (list of consumables per test)
- **SMS** - Short Message Service (text messaging)
- **Lab Tech** - Laboratory Technician
- **Abnormality** - Test result outside normal reference range
- **Reference Range** - Normal values for a test parameter
- **Qualitative** - Non-numeric result (descriptive)
- **Quantitative** - Numeric result (measured value)

### System Limits

- Maximum patients: Unlimited
- Maximum visits per day: Unlimited
- Maximum tests per visit: 50
- Maximum items per purchase: 100
- Maximum SMS per day: Based on provider plan
- Password length: Minimum 6 characters
- File upload size: 5MB per file

### Support Resources

- User Guide (this document)
- Video tutorials (if available)
- In-app help tooltips
- Administrator contact
- Technical support contact

---

**Document Version:** 1.0
**Last Updated:** February 26, 2026
**System Version:** 1.0.0

**For additional assistance, contact your system administrator.**
