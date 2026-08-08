export default function RecoveryPanel() {
  async function triggerRecovery() {
    const eventId = "evt_1";

    await fetch(`/api/replay/recover?eventId=${eventId}`);
  }

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
      <h2 className="text-lg font-semibold mb-3">
        Autonomous Recovery Engine
      </h2>

      <button
        onClick={triggerRecovery}
        className="bg-blue-600 px-3 py-2 rounded-lg text-sm"
      >
        Trigger Recovery
      </button>
    </div>
  );
}

