const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers')

const { getFactoryFactory, readVendoredArtifact } = require('../scripts/v2core')
const { pairFor } = require('../scripts/pairFor')

const MINIMUM_LIQUIDITY = 10n ** 3n

async function deployAllFixture() {
  const [wallet] = await ethers.getSigners()

  const wngrx = await ethers.deployContract('WNGRX')
  const FactoryFactory = await getFactoryFactory(wallet)
  const factory = await FactoryFactory.deploy(wallet.address)
  const router = await ethers.deployContract('UniswapV2Router02', [await factory.getAddress(), await wngrx.getAddress()])

  // Mock ERC20 standing in for MINAR.
  const minar = await ethers.deployContract('ERC20', [ethers.parseUnits('10000', 18)])

  return { wallet, wngrx, factory, router, minar }
}

describe('Nagara DEX integration (local hardhat network)', () => {
  let wallet, wngrx, factory, router, minar
  beforeEach(async () => {
    ;({ wallet, wngrx, factory, router, minar } = await loadFixture(deployAllFixture))
  })

  it('router/library pairFor() matches factory.getPair() for MINAR/WNGRX', async () => {
    const factoryAddress = await factory.getAddress()
    const minarAddress = await minar.getAddress()
    const wngrxAddress = await wngrx.getAddress()

    const deadline = ethers.MaxUint256
    const minarLiquidity = ethers.parseUnits('100', 18)

    await minar.approve(await router.getAddress(), minarLiquidity)
    await router.addLiquidityETH(minarAddress, minarLiquidity, 0, 0, wallet.address, deadline, {
      value: ethers.parseEther('1')
    })

    const actualPair = await factory.getPair(minarAddress, wngrxAddress)
    expect(actualPair).to.not.eq(ethers.ZeroAddress)
    expect(actualPair).to.eq(pairFor(factoryAddress, minarAddress, wngrxAddress))
  })

  it('addLiquidityETH -> swapExactETHForTokens -> swapExactTokensForETH -> removeLiquidityETH', async () => {
    const minarAddress = await minar.getAddress()
    const wngrxAddress = await wngrx.getAddress()
    const routerAddress = await router.getAddress()
    const deadline = ethers.MaxUint256

    const minarLiquidity = ethers.parseUnits('1000', 18)
    const ethLiquidity = ethers.parseEther('10')

    await minar.approve(routerAddress, minarLiquidity)
    await router.addLiquidityETH(minarAddress, minarLiquidity, 0, 0, wallet.address, deadline, {
      value: ethLiquidity
    })

    const pairAddress = await factory.getPair(minarAddress, wngrxAddress)
    const pair = new ethers.Contract(pairAddress, readVendoredArtifact('UniswapV2Pair').abi, wallet)
    expect(await pair.totalSupply()).to.be.above(MINIMUM_LIQUIDITY)

    // swapExactETHForTokens: ETH -> MINAR
    const ethIn = ethers.parseEther('1')
    const minarBalBefore = await minar.balanceOf(wallet.address)
    await router.swapExactETHForTokens(0, [wngrxAddress, minarAddress], wallet.address, deadline, { value: ethIn })
    const minarBalAfter = await minar.balanceOf(wallet.address)
    expect(minarBalAfter).to.be.above(minarBalBefore)

    // swapExactTokensForETH: MINAR -> ETH
    const minarIn = ethers.parseUnits('10', 18)
    await minar.approve(routerAddress, minarIn)
    const ethBalBefore = await ethers.provider.getBalance(wallet.address)
    const tx = await router.swapExactTokensForETH(minarIn, 0, [minarAddress, wngrxAddress], wallet.address, deadline)
    const receipt = await tx.wait()
    const gasCost = receipt.gasUsed * receipt.gasPrice
    const ethBalAfter = await ethers.provider.getBalance(wallet.address)
    expect(ethBalAfter + gasCost).to.be.above(ethBalBefore)

    // removeLiquidityETH
    const liquidity = await pair.balanceOf(wallet.address)
    expect(liquidity).to.be.above(0)
    await pair.approve(routerAddress, liquidity)
    const minarBalBeforeRemove = await minar.balanceOf(wallet.address)
    await router.removeLiquidityETH(minarAddress, liquidity, 0, 0, wallet.address, deadline)
    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await minar.balanceOf(wallet.address)).to.be.above(minarBalBeforeRemove)
  })
})
