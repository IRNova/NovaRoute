/**
 * Google Analytics Module for NovaRoute
 * 
 * Provides analytics tracking for dashboard usage.
 * Uses Google Tag Manager (GTM) for tracking.
 */

/**
 * Analytics Configuration
 */
const ANALYTICS_CONFIG = {
  gtmId: process.env.NEXT_PUBLIC_GTM_ID || "",
  enabled: process.env.ANALYTICS_ENABLED === "true",
  anonymizeIp: true,
  respectDoNotTrack: true,
};

/**
 * Check if analytics is enabled
 */
function isAnalyticsEnabled() {
  return ANALYTICS_CONFIG.enabled && Boolean(ANALYTICS_CONFIG.gtmId);
}

/**
 * Get GTM ID
 */
function getGtmId() {
  return ANALYTICS_CONFIG.gtmId;
}

/**
 * Track custom event
 */
function trackEvent(eventName, parameters = {}) {
  if (!isAnalyticsEnabled()) return;

  // Push to dataLayer
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...parameters,
    });
  }
}

/**
 * Track page view
 */
function trackPageView(pagePath, pageTitle) {
  trackEvent("page_view", {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * Track API request
 */
function trackApiRequest(provider, model, success, duration) {
  trackEvent("api_request", {
    provider,
    model,
    success: success ? "true" : "false",
    duration_ms: duration,
  });
}

/**
 * Track provider connection
 */
function trackProviderConnection(provider, action) {
  trackEvent("provider_connection", {
    provider,
    action, // "connect", "disconnect", "refresh"
  });
}

/**
 * Track feature usage
 */
function trackFeatureUsage(feature, action) {
  trackEvent("feature_usage", {
    feature,
    action,
  });
}

/**
 * Track error
 */
function trackError(errorType, errorMessage, context) {
  trackEvent("error", {
    error_type: errorType,
    error_message: errorMessage,
    context,
  });
}

/**
 * Consent management
 */
function hasConsent() {
  if (!ANALYTICS_CONFIG.respectDoNotTrack) return true;
  
  if (typeof navigator !== "undefined") {
    return navigator.doNotTrack !== "1";
  }
  
  return true;
}

/**
 * Initialize analytics
 */
function initAnalytics() {
  if (!isAnalyticsEnabled()) return null;
  
  return {
    gtmId: ANALYTICS_CONFIG.gtmId,
    enabled: true,
    hasConsent: hasConsent(),
  };
}

module.exports = {
  isAnalyticsEnabled,
  getGtmId,
  trackEvent,
  trackPageView,
  trackApiRequest,
  trackProviderConnection,
  trackFeatureUsage,
  trackError,
  hasConsent,
  initAnalytics,
  ANALYTICS_CONFIG,
};
