import { Island, IslandUpdates, PeerPositionChange } from ".."
import { PeerData, UpdatableArchipelagoParameters } from "../types/interfaces"

export interface IArchipelago {
  getIslandsCount(): number
  getPeersCount(): number
  clearPeers(ids: string[]): IslandUpdates
  getIsland(id: string): Island | undefined
  getIslands(): Island[]
  getPeerData(id: string): PeerData | undefined
  setPeersPositions(requests: PeerPositionChange[]): IslandUpdates
  modifyOptions(options: UpdatableArchipelagoParameters): IslandUpdates;
}
