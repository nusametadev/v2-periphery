require('dotenv/config')
require('@nomicfoundation/hardhat-toolbox')

const PRIVATE_KEY = process.env.PRIVATE_KEY
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : []

// 0.6.6 settings mirror this repo's original .waffle.json exactly (periphery contracts:
// Router/Library/WNGRX/etc).
//
// The 0.5.16 entry is here for Hardhat's multi-compiler support in case anything ever
// imports v2-core .sol sources directly from this project. In practice it currently
// compiles nothing: UniswapV2Factory/UniswapV2Pair are NOT recompiled here. Instead,
// scripts/v2core.js loads v2-core's own precompiled artifacts, vendored at
// artifacts-import/*.json, straight from ~/work/nagara-dex/v2-core/artifacts. That's
// deliberate -- recompiling the same 0.5.16 sources through the node_modules symlink
// ("@uniswap/v2-core/contracts/...") produces a *different* creation bytecode than
// v2-core's own build, because solc's default "ipfs" metadata mode bakes the source file
// path into the bytecode, and 0.5.16 doesn't support metadata.bytecodeHash:"none" (added
// in 0.6.0) to disable that. Vendoring the real artifact sidesteps the whole problem and
// guarantees UniswapV2Library's hardcoded INIT_CODE_HASH matches what's actually
// deployed. See README.md "Nagara deployment" for the full explanation.
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.6.6',
        settings: {
          evmVersion: 'istanbul',
          optimizer: { enabled: true, runs: 999999 }
        }
      },
      {
        version: '0.5.16',
        settings: {
          evmVersion: 'istanbul',
          optimizer: { enabled: true, runs: 999999 }
        }
      }
    ]
  },
  networks: {
    nagaraTestnet: {
      url: process.env.NAGARA_TESTNET_RPC_URL || 'http://212.85.25.146:9944',
      chainId: Number(process.env.NAGARA_TESTNET_CHAIN_ID || 16869),
      accounts
    },
    nagara: {
      url: process.env.NAGARA_MAINNET_RPC_URL || 'http://203.145.34.119:9944',
      chainId: Number(process.env.NAGARA_MAINNET_CHAIN_ID || 16868),
      accounts
    }
  }
}
