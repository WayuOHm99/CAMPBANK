import type { ErrorEvent } from "@sentry/nextjs";

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: event.level,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    message: "Unhandled application error",
    exception: {
      values: event.exception?.values?.map((exception) => ({
        type: /^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError)$/.test(
          exception.type ?? "",
        )
          ? exception.type
          : "Error",
        value: "Unhandled application error",
        stacktrace: {
          frames: exception.stacktrace?.frames?.map((frame) => ({
            filename: frame.filename?.split(/[?#]/, 1)[0].split(/[\\/]/).pop(),
            function: frame.function,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  };
}

export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  enhanceFetchErrorMessages: false as const,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },
  beforeSend: sanitizeSentryEvent,
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
};
