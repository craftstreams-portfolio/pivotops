export function startSystemScheduler() {
  setInterval(async () => {
    console.log(
      "🧠 Running scheduled jobs..."
    );

    // future jobs here
  }, 60000);
}