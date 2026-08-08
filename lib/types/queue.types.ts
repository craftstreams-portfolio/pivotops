export type QueuedEvent = {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  locked?: boolean;
  lockedAt?: number;
};