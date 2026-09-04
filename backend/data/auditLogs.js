const auditLogs = [];

/* =========================================================
   RESET AUDIT LOGS

   We clear the same array so all existing modules
   continue referencing the correct object.
========================================================= */

function resetAuditLogs() {
  auditLogs.splice(
    0,
    auditLogs.length
  );

  return auditLogs;
}

module.exports =
  auditLogs;

module.exports.resetAuditLogs =
  resetAuditLogs;