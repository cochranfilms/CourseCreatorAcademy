type LogLevel = 'info' | 'error' | 'warn';

function base(fields?: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    ts: now,
    ...fields,
  };
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(base({ level: 'info', message, ...(context || {}) })));
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(base({ level: 'warn', message, ...(context || {}) })));
}

export function logError(message: string, context?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(base({ level: 'error', message, ...(context || {}) })));
}


