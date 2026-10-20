// Reimplements UniswapV2Library.pairFor()'s CREATE2 math off-chain in JS, using the
// same INIT_CODE_HASH constant baked into contracts/libraries/UniswapV2Library.sol.
// Used to prove the deployed Factory's actual Pair bytecode matches the hash hardcoded
// in the library (if it didn't, Router operations relying on pairFor would compute a
// wrong address and revert / interact with a non-existent contract).
const { ethers } = require('hardhat')

// Keep this in sync with contracts/libraries/UniswapV2Library.sol.
const INIT_CODE_HASH = '0x6b9987938e755b2114d535286366c6b8f639ef01036880f67b713c25e4f4771c'

function pairFor(factoryAddress, tokenA, tokenB) {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  return ethers.getCreate2Address(
    factoryAddress,
    ethers.solidityPackedKeccak256(['address', 'address'], [token0, token1]),
    INIT_CODE_HASH
  )
}

module.exports = { pairFor, INIT_CODE_HASH }
