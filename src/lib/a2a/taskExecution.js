/**
 * A2A Task Execution — Skill handlers and state management
 */

// ============ Skill Handlers ============

/**
 * @typedef {(task: object) => Promise<{ artifacts: Array<{type: string, content: string}>, metadata: object }>} A2ASkillHandler
 */

/** @type {Record<string, A2ASkillHandler>} */
const A2A_SKILL_HANDLERS = {
  'smart-routing': async (task) => {
    const { executeSmartRouting } = require('./skills/smartRouting');
    return executeSmartRouting(task);
  },
  'quota-management': async (task) => {
    const { executeQuotaManagement } = require('./skills/quotaManagement');
    return executeQuotaManagement(task);
  },
  'provider-discovery': async (task) => {
    const { executeProviderDiscovery } = require('./skills/providerDiscovery');
    return executeProviderDiscovery(task);
  },
  'cost-analysis': async (task) => {
    const { executeCostAnalysis } = require('./skills/costAnalysis');
    return executeCostAnalysis(task);
  },
  'health-report': async (task) => {
    const { executeHealthReport } = require('./skills/healthReport');
    return executeHealthReport(task);
  },
  'list-capabilities': async (task) => {
    const { executeListCapabilities } = require('./skills/listCapabilities');
    return executeListCapabilities(task);
  },
};

/**
 * Execute an A2A task with automatic state management
 * @param {object} tm - Task manager instance
 * @param {object} task
 * @param {Function} handler
 * @returns {Promise<object>}
 */
async function executeA2ATaskWithState(tm, task, handler) {
  try {
    const result = await handler(task);
    tm.updateTask(task.id, 'completed', result.artifacts);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      tm.updateTask(task.id, 'failed', [{ type: 'error', content: msg }], msg);
    } catch {
      // Task may already be terminal (e.g., cancelled)
    }
    throw err;
  }
}

module.exports = { A2A_SKILL_HANDLERS, executeA2ATaskWithState };
