export default function RollbackPanel() {
  async function triggerRollback() {
    const eventId = "evt_1";

    await fetch(`/api/rollback?eventId=${eventId}`);
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
      <h2 className="text-lg font-semibold mb-3">
        Rollback Controller
      </h2>

      <button
        onClick={triggerRollback}
        className="bg-red-600 px-3 py-2 rounded-lg text-sm"
      >
        Execute Rollback
      </button>
    </div>
  );
} 
