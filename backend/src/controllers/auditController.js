const AuditLog = require('../models/AuditLog');

const getAuditLogs = async (req, res, next) => {
  try {
    const { action, targetType, search, page = 1, limit = 25, startDate, endDate } = req.query;
    const query = {};

    if (action && action !== 'ALL') {
      query.action = action;
    }

    if (targetType && targetType !== 'ALL') {
      query.targetType = targetType;
    }

    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { targetName: { $regex: search, $options: 'i' } },
        { targetId: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total, distinctActions] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(query),
      AuditLog.distinct('action'),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      total,
      actions: distinctActions,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
};
