import { recoverFailedEvents } from "../workers/recoverFailedEvents";

setInterval(() => {
  recoverFailedEvents();
}, 60 * 1000);