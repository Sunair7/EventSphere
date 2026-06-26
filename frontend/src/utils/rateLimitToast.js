import toast from 'react-hot-toast';

/**
 * Format a countdown timer
 */
const formatCountdown = (seconds) => {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
};

/**
 * Show a rate limit error toast with a countdown timer
 * @param {Object} error - The error object from the API
 * @param {string} error.message - The error message
 * @param {Object} error.rateLimitInfo - Rate limit details
 * @param {number} error.rateLimitInfo.waitSeconds - Seconds to wait
 * @param {Function} onRetry - Optional callback to retry after cooldown
 * @returns {Object} Toast object with id
 */
export const showRateLimitToast = (error, onRetry) => {
  const { rateLimitInfo, message } = error;
  const waitSeconds = rateLimitInfo?.waitSeconds || 30;
  const limit = rateLimitInfo?.limit || null;
  const remaining = rateLimitInfo?.remaining || null;

  // Build the message
  let displayMessage = message || 'Too many requests. Please try again later.';
  
  // Add wait time if available
  if (waitSeconds && waitSeconds > 0) {
    displayMessage += ` Please wait ${formatCountdown(waitSeconds)}.`;
  }
  
  // Add rate limit context if available
  if (limit && remaining !== null) {
    displayMessage += ` (${remaining}/${limit} remaining)`;
  }

  // Show initial toast
  const toastId = toast.error(displayMessage, {
    duration: waitSeconds > 0 ? waitSeconds * 1000 + 1000 : 5000,
    icon: '⏳',
  });

  // If we have wait seconds and onRetry callback, start countdown timer
  if (waitSeconds > 0 && onRetry) {
    let remainingSeconds = waitSeconds;
    
    // Update toast periodically with countdown
    const updateInterval = setInterval(() => {
      remainingSeconds -= 1;
      
      if (remainingSeconds <= 0) {
        clearInterval(updateInterval);
        // Notify that cooldown is over
        toast.dismiss(toastId);
        const retryToast = toast.success('Cooldown over! You can try again now.', {
          duration: 3000,
        });
        onRetry(retryToast);
      } else {
        // Update existing toast with remaining time (can't update easily with react-hot-toast)
        // Alternative: dismiss and show new toast
        toast.dismiss(toastId);
        const updatedMessage = `${message} Please wait ${formatCountdown(remainingSeconds)}.`;
        toast.error(updatedMessage, {
          id: toastId,
          duration: 1000,
          icon: '⏳',
        });
      }
    }, 1000);

    // Clean up interval when toast is dismissed manually
    const cleanup = () => {
      clearInterval(updateInterval);
      toast.dismiss(toastId);
    };

    // Return a cleanup function
    return {
      id: toastId,
      dismiss: cleanup,
    };
  }

  return { id: toastId, dismiss: () => toast.dismiss(toastId) };
};

/**
 * Check if an error is a rate limit error
 */
export const isRateLimitError = (error) => {
  return error?.isRateLimit === true || error?.statusCode === 429 || error?.response?.status === 429;
};

/**
 * Get rate limit info from an error
 */
export const getRateLimitInfo = (error) => {
  return error?.rateLimitInfo || error?.original?.rateLimitInfo || null;
};