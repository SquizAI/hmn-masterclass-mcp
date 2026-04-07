/**
 * HTTP client — Axios instance with auth headers and error handling.
 */

const axios = require('axios');

/**
 * Create an authenticated HTTP client for the HMN platform API.
 *
 * @param {Object} config - { api_key, api_host }
 * @returns {import('axios').AxiosInstance} — response interceptor returns .data directly
 */
function createHttpClient(config) {
  const client = axios.create({
    baseURL: config.api_host,
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'X-HMN-API-Key': config.api_key,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  // Unwrap response → return .data directly
  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      const status = error.response?.status;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message;

      if (status === 401) {
        return Promise.reject(
          new Error(
            `HMN API auth error (401): Invalid or expired API key. ` +
            `Regenerate at ${config.api_host}/dashboard → Settings → API Key.`
          )
        );
      }

      if (status === 404) {
        return Promise.reject(
          new Error(
            `HMN API not found (404): ${message}. ` +
            `Check that your HMN_API_HOST is correct (current: ${config.api_host}).`
          )
        );
      }

      return Promise.reject(
        new Error(`HMN API error (${status || 'network'}): ${message}`)
      );
    }
  );

  return client;
}

module.exports = { createHttpClient };
