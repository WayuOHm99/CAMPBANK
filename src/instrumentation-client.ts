import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/monitoring/sentry";

if (sentryOptions.dsn) {
  Sentry.init(sentryOptions);
}
