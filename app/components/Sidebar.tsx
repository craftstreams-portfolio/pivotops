import Link from "next/link";

export default function Sidebar() {
  return (
    <div style={{
      width: 220,
      height: "100vh",
      background: "#111",
      color: "white",
      padding: 20,
      position: "fixed"
    }}>
      <h2>PivotOps</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        <li><Link href="/dashboard">Dashboard</Link></li>
        <li><Link href="/recruitment">Recruitment</Link></li>
        <li><Link href="/teams">Pivot Teams</Link></li>
        <li><Link href="/dashboard/components/pivotsos">SOS</Link></li>
        <li><Link href="/workforce">Workforce</Link></li>
        <li><Link href="/showcase">Showcase</Link></li>
        <li><Link href="/spotlight">Spotlight</Link></li>
        <li><Link href="/settings">Settings</Link></li>
      </ul>
    </div>
  );
}