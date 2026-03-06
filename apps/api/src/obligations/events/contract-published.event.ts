/**
 * ContractPublishedEvent — emitted by ContractsService when a contract
 * transitions to `published` status.
 *
 * Consumed by ObligationsListener to trigger schedule generation.
 */
export class ContractPublishedEvent {
  constructor(public readonly contractId: string) {}
}
