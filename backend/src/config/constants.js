module.exports = {
  ADMIN_EMAILS: [
    'technova552026@gmail.com',
    'loganathan8754114450@gmail.com',
  ],
  USER_ROLES: {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  },
  USER_STATUS: {
    PENDING_REQUEST: 'PENDING_REQUEST', // Legacy compatibility
    PENDING: 'PENDING',                 // Access request submitted, waiting for admin approval
    PENDING_ACCESS: 'PENDING',          // Auto-assigned upon Google / Email registration
    APPROVED: 'APPROVED',               // Approved, can access granted folders
    REJECTED: 'REJECTED',               // Rejected with reason
    SUSPENDED: 'SUSPENDED',             // Temporarily suspended
  },
  REQUEST_STATUS: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
  DEFAULT_CATEGORIES: [
    'Operation',
    'Programming',
    'Commissioning',
    'Functions',
    'SIMATIC',
    'Info / Training',
    'Hardware / Installation',
    'Service & Diagnostics',
    'General',
  ]
};
