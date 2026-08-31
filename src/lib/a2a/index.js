/**
 * A2A Protocol — public API
 */

const { getTaskManager, A2ATaskManager } = require('./taskManager');
const { A2A_SKILL_HANDLERS, executeA2ATaskWithState } = require('./taskExecution');
const {
  formatSSE,
  createChunkEvent,
  createCompletionEvent,
  createHeartbeat,
  createFailureEvent,
  SSE_HEADERS,
  createA2AStream,
} = require('./streaming');

module.exports = {
  // Task Manager
  A2ATaskManager,
  getTaskManager,
  
  // Task Execution
  A2A_SKILL_HANDLERS,
  executeA2ATaskWithState,
  
  // Streaming
  formatSSE,
  createChunkEvent,
  createCompletionEvent,
  createHeartbeat,
  createFailureEvent,
  SSE_HEADERS,
  createA2AStream,
};
