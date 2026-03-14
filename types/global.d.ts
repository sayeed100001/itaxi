// Global type extensions
declare global {
  interface Window {
    shareInProgress?: boolean;
    driverMovementInterval?: NodeJS.Timeout;
  }
}

export {};