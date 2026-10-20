// Deploys WNGRX -> UniswapV2Factory -> UniswapV2Router02 in that order, then runs a
// sanity check proving UniswapV2Library's hardcoded INIT_CODE_HASH actually matches the
// deployed Factory's real Pair bytecode (via CREATE2 address equality), and writes
// addresses to deployments/<network>.json.
//
// Local/throwaway networks only for the pairFor sanity check and any test pair/liquidity
// creation -- this script does not add liquidity unless ADD_LIQUIDITY=true, and MINAR
// pair creation is opt-in via MINAR_ADDRESS.
const fs = require('fs')
const path = require('path')
const hre = require('hardhat')
const { ethers, network } = hre
const { getFactoryFactory } = require('./v2core')
const { pairFor } = require('./pairFor')

const LOCAL_NETWORKS = new Set(['hardhat', 'localhost'])

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Network: ${network.name}`)
  console.log(`Deployer: ${deployer.address}`)

  // 1. WNGRX
  const wngrx = await ethers.deployContract('WNGRX')
  await wngrx.waitForDeployment()
  const wngrxAddress = await wngrx.getAddress()
  console.log(`WNGRX deployed: ${wngrxAddress}`)

  // 2. Factory (vendored v2-core artifact, see scripts/v2core.js)
  const feeToSetter = process.env.FEE_TO_SETTER || deployer.address
  const FactoryFactory = await getFactoryFactory(deployer)
  const factory = await FactoryFactory.deploy(feeToSetter)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  console.log(`UniswapV2Factory deployed: ${factoryAddress} (feeToSetter=${feeToSetter})`)

  // 3. Router02
  const router = await ethers.deployContract('UniswapV2Router02', [factoryAddress, wngrxAddress])
  await router.waitForDeployment()
  const routerAddress = await router.getAddress()
  console.log(`UniswapV2Router02 deployed: ${routerAddress}`)

  const pairsCreated = {}

  // Sanity check: only on local/throwaway networks, never on a real chain.
  if (LOCAL_NETWORKS.has(network.name)) {
    const tokenA = await ethers.deployContract('ERC20', [ethers.parseUnits('1000', 18)])
    const tokenAAddress = await tokenA.getAddress()
    const tx = await factory.createPair(tokenAAddress, wngrxAddress)
    await tx.wait()
    const actualPair = await factory.getPair(tokenAAddress, wngrxAddress)
    const expectedPair = pairFor(factoryAddress, tokenAAddress, wngrxAddress)
    if (actualPair.toLowerCase() !== expectedPair.toLowerCase()) {
      throw new Error(
        `INIT_CODE_HASH sanity check FAILED: factory.getPair()=${actualPair} but ` +
          `UniswapV2Library.pairFor() math (off-chain) says ${expectedPair}. ` +
          `UniswapV2Library.sol's hardcoded init code hash does not match this Factory's ` +
          `actual Pair bytecode.`
      )
    }
    console.log(`Sanity check OK: on-chain pair ${actualPair} == off-chain pairFor() ${expectedPair}`)
    pairsCreated.sanityCheckPair = { tokenA: tokenAAddress, tokenB: wngrxAddress, pair: actualPair }
  } else {
    console.log('Skipping pairFor() sanity check: not a local network.')
  }

  // Optional: MINAR/WNGRX pair.
  const minarAddress = process.env.MINAR_ADDRESS
  if (minarAddress) {
    const tx = await factory.createPair(minarAddress, wngrxAddress)
    await tx.wait()
    const minarPair = await factory.getPair(minarAddress, wngrxAddress)
    console.log(`MINAR/WNGRX pair created: ${minarPair}`)
    pairsCreated.minarWngrx = { tokenA: minarAddress, tokenB: wngrxAddress, pair: minarPair }

    if (process.env.ADD_LIQUIDITY === 'true') {
      console.log('ADD_LIQUIDITY=true but no default liquidity amounts are configured; skipping.')
      // Intentionally not adding liquidity automatically: amounts/pricing are a business
      // decision, not something this script should guess. Wire up explicit amounts here
      // (router.addLiquidity(...)) once those numbers are decided.
    }
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    wngrx: wngrxAddress,
    factory: factoryAddress,
    router: routerAddress,
    feeToSetter,
    initCodeHash: require('./pairFor').INIT_CODE_HASH,
    pairsCreated,
    deployedAt: new Date().toISOString()
  }

  const outDir = path.join(__dirname, '..', 'deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `${network.name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2))
  console.log(`Wrote ${outFile}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
