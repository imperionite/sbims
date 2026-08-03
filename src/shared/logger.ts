type LogContext = Record<string, unknown> | undefined;

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        context,
        timestamp: timestamp(),
      }),
    );
  },

  warn(message: string, context?: LogContext) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        context,
        timestamp: timestamp(),
      }),
    );
  },

  error(message: string, error?: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error,
        timestamp: timestamp(),
      }),
    );
  },
};
