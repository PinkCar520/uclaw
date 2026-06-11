/**
 * Ocean Native Bridge
 * Allows the Web application to communicate with the SwiftUI Native container.
 */

export const isNative = () => {
  return typeof window !== 'undefined' && 
         (navigator.userAgent.includes('OceanNative') || !!(window as any).webkit?.messageHandlers?.ocean);
};

export const nativeAction = (action: string, data: any = {}) => {
  if (isNative()) {
    try {
      (window as any).webkit.messageHandlers.ocean.postMessage({
        action,
        ...data
      });
    } catch (e) {
      console.warn('Native bridge call failed:', e);
    }
  } else {
    console.log('Native action simulated on Web:', action, data);
  }
};

/**
 * Trigger native haptic feedback (iOS only)
 */
export const triggerHaptic = () => {
  nativeAction('haptic');
};

/**
 * Copy text using native clipboard to ensure reliability across platforms
 */
export const nativeCopy = (text: string) => {
  nativeAction('copyToClipboard', { text });
};

/**
 * Show a native alert (for critical errors)
 */
export const nativeAlert = (text: string) => {
  nativeAction('alert', { text });
};
