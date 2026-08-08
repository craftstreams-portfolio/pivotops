export async function getDashboardMetrics() {
  return {
    activeRequisitions: 0,
    candidatesInPipeline: 0,
    weeklyApplications: 0,
    timeToHire: 0,
    dropoffRate: 0,
    interviewsScheduled: 0,
    offersSent: 0,
    placementsThisMonth: 0,
    fillRate: 0,
    complianceExpiring: 0,
    openTasks: 0,
    activeTeamMembers: 0,
  };
}