import { UBIClaimed as UBIClaimedEvent } from "../generated/UBIScheme/UBIScheme"
import { UBIClaimed } from "../generated/schema"

export function handleUBIClaimed(event: UBIClaimedEvent): void {
  let entity = new UBIClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.claimer = event.params.claimer
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
