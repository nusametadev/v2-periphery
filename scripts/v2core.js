// Loads OUR v2-core's precompiled Factory/Pair artifacts (vendored into
// artifacts-import/, see README "Nagara deployment" for why) and returns ethers
// ContractFactory objects for them, bypassing Hardhat's name-based artifact lookup
// (which only knows about contracts it compiled itself).
const { ethers } = require('hardhat')

function readVendoredArtifact(name) {
  // eslint-disable-next-line global-require
  return require(`../artifacts-import/${name}.json`)
}

async function getFactoryFactory(signer) {
  const artifact = readVendoredArtifact('UniswapV2Factory')
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
}

async function getPairFactory(signer) {
  const artifact = readVendoredArtifact('UniswapV2Pair')
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
}

function getPairCreationBytecode() {
  return readVendoredArtifact('UniswapV2Pair').bytecode
}

module.exports = { readVendoredArtifact, getFactoryFactory, getPairFactory, getPairCreationBytecode }
