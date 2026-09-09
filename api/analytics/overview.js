const { connectDB } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const Exception = require('../../models/Exception');
const Action = require('../../models/Action');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  await connectDB();

  const [total, byStatus, byType, resolved, autoExecuted, approvalRequired] = await Promise.all([
    Exception.countDocuments({}),
    Exception.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Exception.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    Exception.find({ status: 'resolved' }).select('createdAt resolvedAt'),
    Action.countDocuments({ requiresApproval: false, status: 'completed' }),
    Action.countDocuments({ requiresApproval: true }),
  ]);

  const resolutionTimesHrs = resolved
    .filter((e) => e.resolvedAt)
    .map((e) => (new Date(e.resolvedAt) - new Date(e.createdAt)) / (1000 * 60 * 60));
  const avgResolutionHrs = resolutionTimesHrs.length
    ? Number((resolutionTimesHrs.reduce((a, b) => a + b, 0) / resolutionTimesHrs.length).toFixed(2))
    : null;

  const automationRate = total ? Number((autoExecuted / total).toFixed(2)) : 0;
  const escalationRate = total ? Number((approvalRequired / total).toFixed(2)) : 0;

  return res.status(200).json({
    total_exceptions: total,
    by_status: byStatus,
    by_type: byType,
    avg_resolution_hours: avgResolutionHrs,
    automation_rate: automationRate,
    escalation_rate: escalationRate,
    auto_executed_count: autoExecuted,
    approval_required_count: approvalRequired,
  });
};
