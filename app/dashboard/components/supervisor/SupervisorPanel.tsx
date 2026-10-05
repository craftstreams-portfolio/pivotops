import IncidentLogger from "../pivotsos/IncidentLogger";
import ClockInPanel from "../attendance/ClockInPanel";

export default function SupervisorPanel() {
  return (
    <div>
      <h2>Supervisor Command Center</h2>

      <section>
        <h3>Workforce Attendance</h3>
        <ClockInPanel />
      </section>

      <section>
        <h3>PivotSOS Live Incidents</h3>
        <IncidentLogger />
      </section>
    </div>
  );
}