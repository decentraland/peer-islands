import { orchestatedArchipelago, Position3D } from "../src"
import { defaultOptions } from "../src/Archipelago"
import seedrandom from "seedrandom"
import { sequentialIdGenerator } from "../src/idGenerator"
import { createRandomizer } from "../test/random"

const MAX_PEERS_PER_ISLAND = process.env.MAX_PEERS_PER_ISLAND
  ? parseInt(process.env.MAX_PEERS_PER_ISLAND)
  : defaultOptions().maxPeersPerIsland
const SEED = process.env.SEED ? process.env.SEED : `${seedrandom()()}`
const TARGET_PEERS = parseInt(process.env.TARGET_PEERS ?? "5000")
const DISCONNECT_CHANCE = parseFloat(process.env.DISCONNECT_CHANCE ?? "0.01")
const HOTSPOT_CHANCE = parseFloat(process.env.HOTSPOT_CHANCE ?? "0.95")
const TELEPORT_CHANCE = parseFloat(process.env.TELEPORT_CHANCE ?? "0.01")
const MIN_POSITION = (process.env.MIN_POSITION ? JSON.parse(process.env.MIN_POSITION) : [-2400, 0, -2400]) as Position3D
const MAX_POSITION = (process.env.MAX_POSITION ? JSON.parse(process.env.MAX_POSITION) : [2400, 0, 2400]) as Position3D
const DURATION = parseFloat(process.env.DURATION ?? "120")
const HOTSPOTS = parseInt(process.env.HOTSPOTS ?? "100")

const DEBUG = process.env.DEBUG === "true"

const activePeers: { id: string; position: Position3D }[] = []
const peerIdGenerator = sequentialIdGenerator("Peer")

const orchestator = orchestatedArchipelago({
  joinDistance: 64,
  leaveDistance: 80,
  maxPeersPerIsland: MAX_PEERS_PER_ISLAND,
})

console.log("Using seed " + SEED)

const prng = seedrandom(SEED)

const randomizer = createRandomizer(prng)

function* generateHotspots() {
  for (let i = 0; i < HOTSPOTS; i++) {
    yield randomizer.generatePosition(MIN_POSITION, MAX_POSITION)
  }
}

const hotSpots = [...generateHotspots()]

function generateRandomHotspotPositon(): Position3D {
  const hotspotIndex = randomizer.randomArrayIndex(hotSpots)

  return randomizer.generatePositionAround(hotSpots[hotspotIndex], [64, 0, 64])
}

function generateNewPeerPosition(): Position3D {
  return randomizer.randomBoolean(HOTSPOT_CHANCE)
    ? generateRandomHotspotPositon()
    : randomizer.generatePosition(MIN_POSITION, MAX_POSITION)
}

function addPeer() {
  const randomPosition = generateNewPeerPosition()
  const id = peerIdGenerator.generateId()

  const request = { id, position: randomPosition }

  orchestator.setPeerPosition(request)
  activePeers.push(request)
}

function disconnectRandomPeer() {
  const index = randomizer.randomArrayIndex(activePeers)

  const activePeer = activePeers[index]
  activePeers[index] = activePeers.pop()! // we remove the last element because is fast, and store it in the current index

  orchestator.clearPeer(activePeer.id)
}

function changeRandomPeerPosition() {
  const index = randomizer.randomArrayIndex(activePeers)
  const newPosition = randomizer.randomBoolean(TELEPORT_CHANCE)
    ? generateNewPeerPosition()
    : randomizer.generatePositionAround(activePeers[index].position, [5, 0, 5])
  orchestator.setPeerPosition({ id: activePeers[index].id, position: newPosition })
}

function loop() {
  if (orchestator.getPeersCount() < TARGET_PEERS) {
    addPeer()
  } else {
    if (randomizer.randomBoolean(DISCONNECT_CHANCE)) {
      disconnectRandomPeer()
    } else {
      changeRandomPeerPosition()
    }
  }
}

const startTime = Date.now()
let timeToLog = 1000

console.log(`Starting test at ${startTime}`)

let operations = 0

let elapsed = 0
let currentCycleOperations = 0
let currentCycleStartTime = Date.now()

const logger = DEBUG
  ? async () => {
      console.log(
        `
Performed ${operations} ops. ${((operations * 1000) / elapsed).toFixed(2)} avg ops/s
Last second: ${currentCycleOperations} ops. ${(
          (currentCycleOperations * 1000) /
          (Date.now() - currentCycleStartTime)
        ).toFixed(2)} avg ops/s
Number of peers: ${orchestator.getPeersCount()}
Number of islands: ${await orchestator.getIslandsCount()}
Number of peer per islands: ${(await orchestator.getIslands()).map((it) => it.peers.length)}
Elapsed: ${elapsed / 1000}s. Remaining: ${DURATION - elapsed / 1000}s
    `
      )
    }
  : async () => {
      console.log(
        `
Performed ${operations} ops. ${((operations * 1000) / elapsed).toFixed(2)} avg ops/s
Last second: ${currentCycleOperations} ops. ${(
          (currentCycleOperations * 1000) /
          (Date.now() - currentCycleStartTime)
        ).toFixed(2)} avg ops/s
Number of peers: ${orchestator.getPeersCount()}
Number of islands: ${await orchestator.getIslandsCount()}
Elapsed: ${elapsed / 1000}s. Remaining: ${DURATION - elapsed / 1000}s
    `
      )
    }

const timerLoop = () => {
  for (let i = 0; i < 5000; i++) {
    loop()
    operations++
    currentCycleOperations++
  }

  if (elapsed > timeToLog) {
    logger()
    timeToLog += 1000
    currentCycleStartTime = Date.now()
    currentCycleOperations = 0
  }
  if ((elapsed = Date.now() - startTime) < DURATION * 1000) {
    setTimeout(timerLoop, 20)
  } else {
    orchestator.flush()

    console.log(`Test finished at ${Date.now()}. Total operations: ${operations}`)
  }
}

timerLoop()
