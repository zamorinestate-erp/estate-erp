# Zamorin Cafe ERP — Staff Module Completion Ledger

## Status definitions

- NOT STARTED
- SOURCE VERIFIED
- PARTIAL
- IMPLEMENTED
- TESTED
- COMMITTED
- BLOCKED

A page or file is not considered complete merely because it exists.

A Staff workflow is complete only when its frontend, authenticated API,
MongoDB persistence, self-only permission enforcement, audit events,
notifications, error states and tests are complete.

---

# 1. Source package preservation

Source package:

D:\Zamorin_Cafe_ERP_Build\16_STAFF_LOGOUT_FIX_ORIGINAL

Extracted source:

D:\Zamorin_Cafe_ERP_Build\16_STAFF_LOGOUT_FIX_ORIGINAL\02_EXTRACTED\zamorin-app-v4-staff-logout-fix-20260803

Status: SOURCE VERIFIED

Rules:

- Never edit the source package.
- Never overwrite the integration frontend wholesale.
- Compare every file before integration.
- Make actual changes only in 15_INTEGRATION_WORKSPACE.

---

# 2. Frontend package inventory

Source frontend files: 51

Integration frontend files before Staff completion: 37

## Verified identical files — 21

- README.md
- src/js/ist.js
- src/js/notifications.js
- src/js/pages/announcements.js
- src/js/pages/attendanceShifts.js
- src/js/pages/cafePerformance.js
- src/js/pages/cashBook.js
- src/js/pages/dashboardAdmin.js
- src/js/pages/dashboardMaster.js
- src/js/pages/expenses.js
- src/js/pages/financeAccounts.js
- src/js/pages/notAvailable.js
- src/js/pages/notificationCentre.js
- src/js/pages/personalLedger.js
- src/js/pages/posTill.js
- src/js/pages/reportsAnalytics.js
- src/js/pages/staffAttendance.js
- src/js/pages/staffHome.js
- src/js/pages/staffLeave.js
- src/js/pages/tasksApprovals.js
- src/js/popup.js

Status: SOURCE VERIFIED

## Source-only files requiring integration — 14

- manifest.json
- sw.js
- src/assets/zamorin-app-icon-1024.png
- src/assets/zamorin-app-icon-2048.png
- src/assets/zamorin-app-icon-4096.png
- src/assets/zamorin-app-icon-vector.svg
- src/assets/zamorin-estate-logo.png
- src/assets/zamorin-estate-mark.png
- src/js/globalSearch.js
- src/js/pages/login.js
- src/js/pages/payroll.js
- src/js/payrollEngine.js
- src/js/updateManager.js
- src/js/version.js

Status: NOT STARTED

## Differing files requiring review and selective merge — 16

- index.html
- src/js/components.js
- src/js/icons.js
- src/js/main.js
- src/js/navigation.js
- src/js/pages/administration.js
- src/js/pages/employees.js
- src/js/pages/inventory.js
- src/js/pages/settingsShared.js
- src/js/pages/staffPayslips.js
- src/js/pages/staffSettings.js
- src/js/router.js
- src/js/state.js
- src/styles/components.css
- src/styles/layout.css
- src/styles/tokens.css

Status: NOT STARTED

---

# 3. Existing Staff pages

## Staff Home

File:

src/js/pages/staffHome.js

Required final functions:

- Personal Staff dashboard
- Profile shortcut
- Current attendance status
- Next shift
- Leave balance
- Latest payslip
- Assigned tasks
- Announcements
- Notifications
- Loans or advances summary where applicable
- Documents requiring acknowledgement
- Loading, empty and error states
- Backend-derived data only

Status: PARTIAL

## Staff Attendance

File:

src/js/pages/staffAttendance.js

Required final functions:

- Backend-generated check-in time
- Backend-generated check-out time
- Current open shift
- Attendance history
- Shift duration
- Self-only access
- Duplicate check-in prevention
- Invalid check-out prevention
- Offline and API error handling
- Audit events
- Notifications where applicable

Status: PARTIAL

## Staff Leave

File:

src/js/pages/staffLeave.js

Required final functions:

- Leave balances
- Leave request creation
- Request history
- Approval status
- Cancellation rules
- Date validation
- Attachment support where applicable
- Self-only access
- Audit events
- Decision notifications

Status: PARTIAL

## Staff Payslips and Salary

File:

src/js/pages/staffPayslips.js

Required final functions:

- Salary overview
- Current and historical payslips
- Backend payroll data
- Self-only access
- Payslip breakdown
- Secure PDF download
- No hard-coded employee ID
- No hard-coded payroll period
- No browser-only payroll authority
- Loading, empty and error states

Status: PARTIAL

## Staff Announcements

File:

src/js/pages/announcements.js

Required final functions:

- Role and café-targeted announcements
- Backend persistence
- Read status
- Acknowledgement where required
- Attachment and deep-link support where applicable
- Self-only authenticated access

Status: PARTIAL

## Staff Notifications

Existing shared file:

src/js/pages/notificationCentre.js

Required final functions:

- Accessible from Staff mobile shell
- Staff-targeted notifications only
- Mark read
- Acknowledge
- Deep links
- Notification preferences
- Loading, empty and error states
- Backend API integration

Status: PARTIAL

## Staff Settings and Security

File:

src/js/pages/staffSettings.js

Required final functions:

- Theme
- Font size
- Language
- Notification preferences
- MFA status where applicable
- Password change
- Session listing
- Session revocation
- Secure backend logout
- Protected-cache clearing
- Cross-tab logout
- Browser Back protection
- Mobile shell logout button
- App version and update handling

Status: PARTIAL

---

# 4. New Staff frontend pages required

## Staff Profile

Planned file:

src/js/pages/staffProfile.js

Required functions:

- Own profile only
- Contact details
- Employment details allowed for Staff
- Café assignment
- Emergency contact where approved
- Masked sensitive values
- Permitted profile update requests
- Documents summary

Status: NOT STARTED

## Staff Schedule

Planned file:

src/js/pages/staffSchedule.js

Required functions:

- Current schedule
- Upcoming shifts
- Shift details
- Café and station where applicable
- Schedule changes
- Shift notifications
- Self-only access

Status: NOT STARTED

## Staff Tasks

Planned file:

src/js/pages/staffTasks.js

Required functions:

- Assigned tasks only
- Due date
- Priority
- Instructions
- Evidence upload where required
- Status updates
- Completion acknowledgement
- Audit events
- Notifications

Status: NOT STARTED

## Staff Loans and Advances

Planned file:

src/js/pages/staffLoansAdvances.js

Required functions:

- Own loans only
- Own salary advances only
- Outstanding balance
- Instalment schedule
- Request workflow
- Approval status
- Payroll deduction visibility
- Secure supporting documents

Status: NOT STARTED

## Staff Documents

Planned file:

src/js/pages/staffDocuments.js

Required functions:

- Own employment documents
- Policies
- Payslip and payroll documents where applicable
- Download controls
- Expiry indicators
- Required acknowledgements
- Audit history
- Self-only access

Status: NOT STARTED

---

# 5. Navigation and routing

Required Staff navigation:

- Home
- My Profile
- My Attendance
- My Schedule
- My Leave
- My Tasks
- My Payslips
- Loans and Advances
- My Documents
- Announcements
- Notifications
- Settings

Files requiring work:

- src/js/navigation.js
- src/js/router.js
- src/js/main.js
- src/js/components.js
- src/js/globalSearch.js

Rules:

- Staff must never see management modules.
- Staff must never access another user's data.
- Hidden navigation is not a security control.
- Every backend query must enforce authenticated user ownership.
- Personal Ledger must never appear for Staff.
- Global Search must return only permitted Staff results.

Status: NOT STARTED

---

# 6. Authentication and logout

Frontend files:

- src/js/pages/login.js
- src/js/main.js
- src/js/state.js
- src/js/components.js
- src/js/pages/staffSettings.js

Backend files already present:

- src/controllers/authController.js
- src/routes/authRoutes.js
- src/services/authService.js
- src/services/mfaService.js
- src/models/Session.js
- src/models/User.js

Required work:

- Replace demo login with backend authentication.
- Preserve STAFF login without mandatory privileged-role MFA.
- Store authentication state securely.
- Use secure cookies according to backend design.
- Refresh sessions safely.
- Logout through backend API.
- Revoke current session.
- Clear protected frontend state and caches.
- Disconnect real-time connections.
- Synchronise logout across tabs.
- Prevent protected UI restoration through browser Back.
- Record logout audit events.

Status: PARTIAL

---

# 7. Existing backend support

Present backend models:

- User
- Session
- Attendance
- Notification
- AuditEvent
- RolePermission
- SequenceCounter
- Cafe

Present relevant controllers:

- authController
- attendanceController
- notificationController
- userController
- auditController

Present relevant routes:

- authRoutes
- attendanceRoutes
- notificationRoutes
- userRoutes
- auditRoutes

Status: PARTIAL

---

# 8. Missing backend Staff-domain support

The final architecture may combine related endpoints where appropriate,
but every workflow below requires persistent models and authenticated APIs.

## Staff profile support

Required:

- Staff profile fields or a dedicated StaffProfile/EmployeeProfile model
- Own-profile read endpoint
- Safe profile update or update-request endpoint
- Sensitive-field masking
- Audit events

Status: NOT STARTED

## Leave support

Expected files or equivalent architecture:

- src/models/LeaveRequest.js
- src/controllers/leaveController.js
- src/routes/leaveRoutes.js

Required:

- Leave balances
- Staff request creation
- Staff request history
- Cancellation
- Management decision workflow
- Notifications
- Audit events

Status: NOT STARTED

## Schedule support

Expected files or equivalent architecture:

- src/models/ShiftSchedule.js
- src/controllers/scheduleController.js
- src/routes/scheduleRoutes.js

Required:

- Staff self schedule
- Management schedule creation/update
- Café scoping
- Shift-change notifications
- Audit events

Status: NOT STARTED

## Task support

Expected files or equivalent architecture:

- src/models/StaffTask.js
- src/controllers/taskController.js
- src/routes/taskRoutes.js

Required:

- Staff assigned-task list
- Task status updates
- Evidence
- Due dates
- Escalation
- Notifications
- Audit events

Status: NOT STARTED

## Payroll and payslip support

Expected files or equivalent architecture:

- src/models/PayrollRun.js
- src/models/Payslip.js
- src/controllers/payrollController.js
- src/routes/payrollRoutes.js

Required:

- Immutable payroll periods
- Staff self payslip access
- Salary breakdown
- Secure PDF generation
- Payroll approval
- Audit events

Status: NOT STARTED

## Loans and advances support

Expected files or equivalent architecture:

- src/models/StaffLoanAdvance.js
- src/controllers/loanAdvanceController.js
- src/routes/loanAdvanceRoutes.js

Required:

- Staff request workflow
- Approval
- Instalment schedule
- Payroll deduction linkage
- Outstanding balance
- Audit events
- Notifications

Status: NOT STARTED

## Staff document support

Expected files or equivalent architecture:

- src/models/StaffDocument.js
- src/controllers/staffDocumentController.js
- src/routes/staffDocumentRoutes.js

Required:

- Own document access
- Secure file metadata
- Expiry
- Acknowledgement
- Audit events
- Permission enforcement

Status: NOT STARTED

## Announcement support

Expected files or equivalent architecture:

- src/models/Announcement.js
- src/controllers/announcementController.js
- src/routes/announcementRoutes.js

Required:

- Role targeting
- Café targeting
- Publish/archive
- Read and acknowledgement status
- Notifications
- Audit events

Status: NOT STARTED

---

# 9. Staff permission rules

Mandatory:

- Staff can read only their own profile.
- Staff can read and modify only their own permitted attendance actions.
- Staff can read and manage only their own leave requests.
- Staff can read only their own schedule.
- Staff can read and update only tasks assigned to them.
- Staff can read only their own payslips, loans and advances.
- Staff can read only documents assigned to them.
- Staff cannot access management reports.
- Staff cannot access cash books.
- Staff cannot access expenses belonging to others.
- Staff cannot access Personal Ledger.
- Staff cannot switch roles.
- Staff cannot bypass access through URLs or API calls.
- All ownership rules must be enforced by the backend.

Status: NOT STARTED

---

# 10. UX completion requirements

Every Staff screen requires:

- Loading state
- Empty state
- Error state
- Retry control where appropriate
- Offline state where appropriate
- Mobile-first layout
- Keyboard accessibility where applicable
- Screen-reader labels
- Touch-friendly controls
- IST display
- INR display
- Confirmation for destructive actions
- No sample data in production flows

Status: NOT STARTED

---

# 11. Testing requirements

Required automated and manual tests:

- Staff login
- Invalid login
- Staff logout
- Session revocation
- Browser Back after logout
- Cross-tab logout
- Attendance check-in
- Duplicate check-in rejection
- Attendance check-out
- Invalid check-out rejection
- Staff cannot read another user's attendance
- Leave creation
- Leave validation
- Leave cancellation
- Schedule self-access
- Task self-access
- Task status update
- Payslip self-access
- Another Staff user's payslip rejection
- Loans and advances self-access
- Document self-access
- Announcement targeting
- Notification targeting
- Deep-link protection
- Global Search permission filtering
- Mobile navigation
- Offline/error states

Status: NOT STARTED

---

# 12. Final Staff acceptance condition

The Staff module may be marked complete only when:

- Every source package file is accounted for.
- Every required Staff page is implemented.
- Every required Staff backend workflow is implemented.
- MongoDB persistence is active.
- Self-only permission checks are tested.
- Backend server time is used for attendance.
- Login and logout are fully connected.
- Notifications and audit events are connected.
- Reports include permitted Staff-related management data.
- Automated checks pass.
- Manual Staff acceptance tests pass.
- Git working tree is clean.
- A final Staff completion report is committed.

Overall Staff status: PARTIAL
