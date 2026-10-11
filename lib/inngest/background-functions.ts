import { inngest } from './client';

export const processTaskBackgroundJob = inngest.createFunction(
  {
    id: 'process-task-job',
    name: 'Process Task Background Job',
    retries: 3,
  },
  { event: 'app/task.process' },
  async ({ event, step }) => {
    // Step 1: Initialize background task
    const initialResult = await step.run('init-task', async () => {
      console.log('Starting background processing for task payload:', event.data);
      return { taskId: event.data?.taskId || 'task_default', status: 'initialized' };
    });

    // Step 2: Pause or simulate asynchronous workflow delays
    await step.sleep('wait-for-processing', '2s');

    // Step 3: Complete background processing
    const completedResult = await step.run('complete-task', async () => {
      console.log('Completed processing task:', initialResult.taskId);
      return {
        taskId: initialResult.taskId,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      data: completedResult,
    };
  }
);
