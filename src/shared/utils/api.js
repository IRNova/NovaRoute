/**
 * API utility functions for making HTTP requests
 */

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Make a GET request
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<object>}
 */
export async function get(url, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    method: "GET",
    headers: { ...DEFAULT_HEADERS, ...optHeaders },
  });
  return handleResponse(response);
}

/**
 * Make a POST request
 * @param {string} url - API endpoint
 * @param {object} data - Request body
 * @param {object} options - Fetch options
 * @returns {Promise<object>}
 */
export async function post(url, data, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    method: "POST",
    headers: { ...DEFAULT_HEADERS, ...optHeaders },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Make a PUT request
 * @param {string} url - API endpoint
 * @param {object} data - Request body
 * @param {object} options - Fetch options
 * @returns {Promise<object>}
 */
export async function put(url, data, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    method: "PUT",
    headers: { ...DEFAULT_HEADERS, ...optHeaders },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Make a DELETE request
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<object>}
 */
export async function del(url, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    method: "DELETE",
    headers: { ...DEFAULT_HEADERS, ...optHeaders },
  });
  return handleResponse(response);
}

/**
 * Handle API response
 * @param {Response} response - Fetch response
 * @returns {Promise<object>}
 */
async function handleResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "An error occurred");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

const api = { get, post, put, del };
export default api;

