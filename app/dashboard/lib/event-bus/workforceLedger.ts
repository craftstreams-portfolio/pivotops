export interface WorkforceLedgerEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

const ledger: WorkforceLedgerEvent[] = [];

export function storeLedgerEvent(event: WorkforceLedgerEvent) {
  ledger.unshift(event);
}

export function getLedgerEvents() {
  return ledger;
}

export function clearLedger() {
  ledger.length = 0;
}