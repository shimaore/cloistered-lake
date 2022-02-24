import {Lake,bigNaturals,empty,merge,from,sleep} from '..'
Lake( process.stdin )
import {pipeline} from 'stream'
import * as fs from 'fs'
pipeline(
  bigNaturals().skip(1).map( x => x*x ).first(1000).map( x => `${x}\n` ),
  // This will create a file containing the first thousand squares
  fs.createWriteStream('thousand-squares.txt'),
  console.error
)
const BigIntegers = merge(
  // will enumerate 1, 2, 3, 4, …
  bigNaturals().skip(1),
  // will enumerate 0, -1, -2, -3, …
  bigNaturals().map( x => -x ),
)
const firstTwentyIntegers = from(
  [0,-1,1,-2,2,-3,3,-4,4,-5,5,-6,6,-7,7,-8,8,-9,9,-10].map(BigInt)
)
import test from 'ava'
test('Compute first twenty integers', async t => {
  t.true(await
    BigIntegers
    .first(20)
    .equals( firstTwentyIntegers )
  )
})
const Sum = (a:bigint,v:bigint) => a+v
test('Compute the sum of the first 1000 squares', async t => {
  t.is( 333_833_500n, await
    bigNaturals()
    .skip(1)
    .map( x => x*x )
    .first(1000n)
    .reduce(Sum, 0n)
  )
})
const squareMicroService = async (x:bigint) => {
  await sleep(1)
  return x*x
}
test('Compute the sum of the first 1000 squares using concurrentMap', async t => {
  console.time('with concurrentMap')
  t.is( 333_833_500n, await
    bigNaturals()
    .skip(1)
    .concurrentMap(100,squareMicroService)
    .first(1000n)
    .reduce(Sum, 0n)
  )
  console.timeEnd('with concurrentMap')
})
test('Compute the sum of the first 1000 squares without concurrentMap', async t => {
  console.time('without concurrentMap')
  t.is( 333_833_500n, await
    bigNaturals()
    .skip(1)
    .map( squareMicroService )
    .first(1000n)
    .reduce(Sum, 0n)
  )
  console.timeEnd('without concurrentMap')
})
test('Retrieve the 14th BigInt', async t => {
  t.is(14n as bigint | undefined, await
    bigNaturals()
    .skip(1) // skip 0
    .first(14)
    .last()
  )
})
test('Enumerates empty', async t => {
  await empty().concurrentMap(10, () => true ).run()
  t.pass()
})
