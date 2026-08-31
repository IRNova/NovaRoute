/**
 * A2A SSE Streaming Support
 * 
 * Provides SSE event formatting for A2A `message/stream` responses.
 * Features: heartbeat (15s), chunk emission, metadata final event, cancellation.
 */

// ============ SSE Event Formatting ============

/**
 * Format an SSE event line
 * @param {object} event
 * @returns {string}
 */
function formatSSE(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a chunk event for streaming text content
 * @param {string} taskId
 * @param {string} content
 * @returns {string}
 */
function createChunkEvent(taskId, content) {
  return formatSSE({
    jsonrpc: '2.0',
    method: 'message/stream',
    params: {
      task: { id: taskId, state: 'working' },
      chunk: { type: 'text', content },
    },
  });
}

/**
 * Create the final completion event with metadata
 * @param {string} taskId
 * @param {object} metadata
 * @returns {string}
 */
function createCompletionEvent(taskId, metadata) {
  return formatSSE({
    jsonrpc: '2.0',
    method: 'message/stream',
    params: {
      task: { id: taskId, state: 'completed' },
      metadata,
    },
  });
}

/**
 * Create a heartbeat event to keep the connection alive
 * @param {string} taskId
 * @returns {string}
 */
function createHeartbeat(taskId) {
  return `: heartbeat ${new Date().toISOString()}\n\n`;
}

/**
 * Create a failure event
 * @param {string} taskId
 * @param {string} error
 * @returns {string}
 */
function createFailureEvent(taskId, error) {
  return formatSSE({
    jsonrpc: '2.0',
    method: 'message/stream',
    params: {
      task: { id: taskId, state: 'failed' },
      metadata: { error },
    },
  });
}

/**
 * SSE response headers for A2A streaming
 */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Create a streaming SSE handler that wraps a skill execution.
 * Returns a ReadableStream suitable for a Response object.
 * 
 * @param {object} task
 * @param {Function} executeSkill - async (task) => { artifacts, metadata }
 * @param {AbortSignal} [abortSignal]
 * @param {{ onStart?: () => void; onEnd?: () => void }} [lifecycle]
 * @returns {ReadableStream}
 */
function createA2AStream(task, executeSkill, abortSignal, lifecycle) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      lifecycle?.onStart?.();

      // Heartbeat interval
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(createHeartbeat(task.id)));
        } catch {
          /* stream closed */
        }
      }, 15_000);

      try {
        if (abortSignal?.aborted) {
          controller.enqueue(encoder.encode(createFailureEvent(task.id, 'Cancelled')));
          controller.close();
          return;
        }

        const result = await executeSkill(task);

        // Emit content as chunks
        for (const artifact of result.artifacts) {
          if (abortSignal?.aborted) break;
          controller.enqueue(encoder.encode(createChunkEvent(task.id, artifact.content)));
        }

        if (abortSignal?.aborted) {
          controller.enqueue(encoder.encode(createFailureEvent(task.id, 'Cancelled')));
          return;
        }

        // Emit completion with metadata
        controller.enqueue(encoder.encode(createCompletionEvent(task.id, result.metadata)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(createFailureEvent(task.id, msg)));
      } finally {
        clearInterval(heartbeatInterval);
        lifecycle?.onEnd?.();
        controller.close();
      }
    },
  });
}

module.exports = {
  formatSSE,
  createChunkEvent,
  createCompletionEvent,
  createHeartbeat,
  createFailureEvent,
  SSE_HEADERS,
  createA2AStream,
};
