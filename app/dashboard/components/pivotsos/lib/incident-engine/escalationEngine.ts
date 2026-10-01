export interface EscalationAction {
  notifyHR: boolean;
  notifySecurity: boolean;
  lockWorkspace: boolean;
  priority: number;
}

export function buildEscalationPlan(severity: string): EscalationAction {
  switch (severity) {
    case "critical":
      return {
        notifyHR: true,
        notifySecurity: true,
        lockWorkspace: true,
        priority: 100,
      };

    case "high":
      return {
        notifyHR: true,
        notifySecurity: false,
        lockWorkspace: false,
        priority: 75,
      };

    case "medium":
      return {
        notifyHR: true,
        notifySecurity: false,
        lockWorkspace: false,
        priority: 50,
      };

    default:
      return {
        notifyHR: false,
        notifySecurity: false,
        lockWorkspace: false,
        priority: 10,
      };
  }
}