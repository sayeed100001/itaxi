// Global type extensions
declare global {
  interface Window {
    shareInProgress?: boolean;
    driverMovementInterval?: NodeJS.Timeout;
  }

  // Minimal JSX typings to keep `tsc --noEmit` working even when `@types/react`
  // is not installed. This intentionally keeps JSX permissive (any intrinsic elements).
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
