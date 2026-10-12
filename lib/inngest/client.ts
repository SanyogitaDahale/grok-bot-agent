import { Inngest } from 'inngest';

// Create an Inngest client to send and receive events
export const inngest = new Inngest({
  id: 'fastnext-app',
  // Local app runs should send events to the Inngest Dev Server, which accepts
  // local events without a production event key. Keep cloud mode for deploys.
  isDev: process.env.NODE_ENV === 'development' ? true : undefined,
  eventKey: process.env.NODE_ENV === 'development' ? undefined : process.env.INNGEST_EVENT_KEY,
});
