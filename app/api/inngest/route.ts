import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { processTaskBackgroundJob } from '@/lib/inngest/background-functions';
import {
  scheduleRoutineExecutions,
  executeScheduledRoutine,
  pruneExpiredAgentChatHistory,
} from '@/lib/inngest/functions';

// Create an API route that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processTaskBackgroundJob,
    scheduleRoutineExecutions,
    executeScheduledRoutine,
    pruneExpiredAgentChatHistory,
  ],
});
