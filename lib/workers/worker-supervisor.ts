import { startWorkers } from "./start-workers";

export async function startWorkerSupervisor() {
  while (true) {
    try {
      await startWorkers();
    } catch (err) {
      console.error(
        "🔥 Workers crashed. Restarting...",
        err
      );

      await sleep(5000);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}