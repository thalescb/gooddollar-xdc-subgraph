import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import { UBIClaimed } from "../generated/UBIScheme/UBIScheme"

export function createUBIClaimedEvent(
  claimer: Address,
  amount: BigInt
): UBIClaimed {
  let ubiClaimedEvent = changetype<UBIClaimed>(newMockEvent())

  ubiClaimedEvent.parameters = new Array()

  ubiClaimedEvent.parameters.push(
    new ethereum.EventParam("claimer", ethereum.Value.fromAddress(claimer))
  )
  ubiClaimedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return ubiClaimedEvent
}
