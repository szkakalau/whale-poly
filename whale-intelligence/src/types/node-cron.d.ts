declare module 'node-cron' {
  export interface ScheduleOptions {
    timezone?: string;
  }

  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): any;

  const _default: {
    schedule: typeof schedule;
  };
  export default _default;
}