const AuditLog = require('../models/AuditLog');

const logAudit = async ({
  action,
  user,
  targetType,
  targetId = '',
  targetName = '',
  details = {},
  req = null,
}) => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      userAgent = req.headers['user-agent'] || '';
    }

    const auditEntry = new AuditLog({
      action,
      performedBy: user?._id || user?.id || null,
      userEmail: user?.email || 'SYSTEM',
      userName: user?.name || 'SYSTEM',
      targetType,
      targetId: String(targetId || ''),
      targetName: String(targetName || ''),
      details,
      ipAddress,
      userAgent,
    });

    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    console.error('[AuditLog Error]', error.message);
  }
};

module.exports = { logAudit };
