# Uniswap V2

[![Actions Status](https://github.com/Uniswap/uniswap-v2-periphery/workflows/CI/badge.svg)](https://github.com/Uniswap/uniswap-v2-periphery/actions)
[![npm](https://img.shields.io/npm/v/@uniswap/v2-periphery?style=flat-square)](https://npmjs.com/package/@uniswap/v2-periphery)

In-depth documentation on Uniswap V2 is available at [uniswap.org](https://uniswap.org/docs).

The built contract artifacts can be browsed via [unpkg.com](https://unpkg.com/browse/@uniswap/v2-periphery@latest/).

# Local Development

The following assumes the use of `node@>=10`.

## Install Dependencies

`yarn`

## Compile Contracts

`yarn compile`

## Run Tests

`yarn test`

## Nagara deployment

This fork targets the Nagara chain. v2-core was renamed (LP token "Nagara LP" / "NGR-LP"),
which changes `UniswapV2Pair`'s creation bytecode, so `UniswapV2Library`'s hardcoded
`INIT_CODE_HASH` differs from upstream Uniswap. This repo depends on a **local, unpushed**
build of v2-core (`"@uniswap/v2-core": "file:../v2-core"` in package.json, branch
`feat/nagara-dex`). Once that branch is pushed, switch the dependency to
`"@uniswap/v2-core": "github:nusametadev/v2-core#feat/nagara-dex"` and re-run `npm install`.

Factory/Pair bytecode: this project does **not** recompile v2-core's `.sol` sources.
Recompiling the same 0.5.16 sources through the `node_modules` symlink produces a
*different* creation bytecode than v2-core's own build (solc's default metadata mode
bakes the source file path into the bytecode, and 0.5.16 has no `bytecodeHash: "none"`
escape hatch). Instead, `scripts/v2core.js` loads v2-core's real compiled artifacts,
vendored at `artifacts-import/UniswapV2Factory.json` and `artifacts-import/UniswapV2Pair.json`
(copied straight from v2-core's own `artifacts/` after running `npm run compile` there).
Re-copy those two files whenever v2-core's contracts or compiler settings change.

### NGRX-only pairs

The v2-core Factory (`feat/ngrx-pair-whitelist`) only creates pairs that include WNGRX. Pairs without WNGRX
must be whitelisted by `Factory.admin` via `setPairAllowed(tokenA, tokenB, true)` before `addLiquidity` /
`createPair`. The constructor is `(feeToSetter, wngrx, admin)`; `scripts/deploy.js` uses the deployer for
`admin` unless `ADMIN` is set. Changing the Factory changes the Pair metadata hash, so the vendored
artifacts and `INIT_CODE_HASH` were regenerated.

### Commands

- Build: `npm run compile`
- Test: `npm test` (includes `test/integration.spec.js`, the full add/swap/remove-liquidity
  flow against a freshly deployed Factory/Router/WNGRX on the in-memory Hardhat network)
- Print/verify the init code hash: `cd ../v2-core && npm run init-code-hash` — compare its
  output against the hex literal in `contracts/libraries/UniswapV2Library.sol` and against
  `scripts/pairFor.js`'s `INIT_CODE_HASH` constant (all three must match)
- Deploy:
  - Local: `npx hardhat run scripts/deploy.js --network hardhat`
  - Testnet: `PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network nagaraTestnet`
  - Mainnet: `PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network nagara`
  - Copy `.env.example` to `.env` to set `PRIVATE_KEY`, `FEE_TO_SETTER`, `ADMIN`, `MINAR_ADDRESS` instead
    of passing them inline. `.env` is gitignored; never commit it.

Deploy order (enforced by `scripts/deploy.js`): **WNGRX -> Factory -> Router02 -> optionally
createPair**. The script also sanity-checks that `UniswapV2Library.pairFor()`'s CREATE2 math
matches the real deployed Pair address (local networks only), and writes addresses to
`deployments/<network>.json`.
