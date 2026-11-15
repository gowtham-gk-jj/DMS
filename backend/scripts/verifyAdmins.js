const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { USER_ROLES, USER_STATUS, ADMIN_EMAILS } = require('../src/config/constants');

async function syncAndVerifyAdmins() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const adminProfiles = [
    {
      email: 'technova552026@gmail.com',
      name: 'Primary System Administrator (TechNova)',
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.APPROVED,
      permissions: { read: true, upload: true, download: true, manage: true },
    },
    {
      email: 'loganathan8754114450@gmail.com',
      name: 'Secondary System Administrator (Loganathan)',
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.APPROVED,
      permissions: { read: true, upload: true, download: true, manage: true },
    },
  ];

  for (const profile of adminProfiles) {
    let user = await User.findOne({ email: profile.email.toLowerCase().trim() }).select('+password');
    if (!user) {
      user = new User({
        email: profile.email.toLowerCase().trim(),
        name: profile.name,
        role: profile.role,
        status: profile.status,
        permissions: profile.permissions,
        password: 'Admin@2026!',
        organization: 'Enterprise DMS Administration',
        department: 'Core Infrastructure',
      });
      await user.save();
      console.log(`[Created Admin] ${profile.email}`);
    } else {
      user.role = profile.role;
      user.status = profile.status;
      user.permissions = profile.permissions;
      if (!user.name) user.name = profile.name;
      if (!user.password) {
        user.password = 'Admin@2026!';
      }
      await user.save();
      console.log(`[Verified/Updated Admin] ${profile.email} -> ID: ${user._id}`);
    }
  }

  // Count total admins
  const totalAdmins = await User.countDocuments({ role: USER_ROLES.ADMIN });
  console.log(`Total Administrators in DB: ${totalAdmins}`);

  await mongoose.disconnect();
}

syncAndVerifyAdmins().catch((err) => {
  console.error('Error syncing admins:', err);
  process.exit(1);
});
