Functional async generators
===========================

The base concept is that async iterators are streams, and that we should provide
tools to handle them.

This is similar to the concepts enabled by `most.js` or `rxjs`, but without a
proprietary loop: the scheduling is entirely done by the JavaScript engine using
async generators.

Since all operations are async, the streams are non-blocking.

Compatibility with Node.js streams
==================================

These streams are compatible with Node.js' [Readable Stream API](https://nodejs.org/dist/latest-v15.x/docs/api/stream.html#stream_readable_symbol_asynciterator):

    import {Lake} from '@shimaore/lake'
    Lake( process.stdin )

and with Node.js' Writeable Stream API, using [`pipeline`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_stream_pipeline_streams_callback) or [`Readable.from`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_stream_readable_from_iterable_options):

    import {pipeline} from 'stream'
    import fs from 'fs'
    import {bigNaturals} from '@shimaore/lake'
    pipeline(
      bigNaturals().skip(1).map( x => x*x ).first(1000).map( x => `${x}\n` ),
      // This will create a file containing the first thousand squares
      fs.createWriteStream('thousand-squares.txt'),
      console.error
    )

Fluent API, Merging streams
===========================

Some basic data streaming example, first one building integers (positive and
negative) from naturals (positive only):

    import {merge,from} from '@shimaore/lake'

Merging streams is done in approximate round-robin fashion; this prevents one
stream from eagerly blocking other stream.

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

Notice how `first` and `equals` are methods on the stream.


Building the sum of the first 1000 squares in constant space:

    const Sum = (a,v) => a+v

    test('Compute the sum of the first 1000 squares', async t => {
      t.is( 333_833_500n, await

        bigNaturals()
        .skip(1)
        .map( x => x*x )
        .first(1000n)
        .reduce(Sum, 0n)

      )
    })

Concurrent Map
==============

Use Concurrent Map to process async calls concurrently while controlling the
maximum number of concurrent executions.

    import {sleep} from '@shimaore/lake'

    const squareMicroService = async (x) => {
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

Tests
=====

The examples in this README file are used as tests.

```
yarn install && yarn test
```

API
===

# Lake(stream|iterator)

An Async Iterator that behaves as a Readable Stream and supports Monadic Event
Stream patterns, using only native operators.

It can be used as a proxy for the original (sync or async) iterator, turning it
into an async iterator.

It also is an async iterable, which means it can be turned into a stream.

## .map(transform)

Applies a (sync or async) transformation function to each element in the stream.

## .concurrentMap(atmost,transform)

Applies an async transformation function to each element in the stream, running
at most `atmost` instances concurrently.

The ordering of the elements is not guaranteed, since it will depend on the
evaluation time of the async `transform` function.

## .constant(value)

Transform this stream into a stream that produces the `value` for each element
the original stream produces.

## .filter(fun)

Only forward stream values for which the (sync or async) `fun` function returns
(a Promise for) a truthy value.

## .skipRepeats()
## .skipRepeats(isEqual)

When successive values are identical, only the first one is propagated.

Optionally, a (sync or async) comparison function might be provided to compare
using a different criteria than `===`; it should return `true` if its two
arguments are considered identical.

## .first(n)
## .take(n)

Only propagates the first `n` elements in the stream.

BigInt are used internally; `n` might be a integer or a BigInt.

## .skip(n)

Skips the first `n` elements in the stream and only start propagating after the
`n`-th element has been received.

BigInt are used internally; `n` might be a integer or a BigInt.

## .delay(timeout)

Insert a delay of `timeout` milliseconds between each received element.

## .startWith(otherStream)

Concatenates the otherStream with this stream.

## .continueWith(otherStream)

Contatenates this stream then the otherStream.

## .forEach(func)
## .tap(func)

Executes the (sync or async) `func` function for each element in the stream.
The stream is unmodified but might be delayed by the execution time of `func`.
The stream will fail if `func` fails or rejects.

## .ap(funs)

Apply a stream of (sync or async) functions to this stream.

Elements of this stream are dropped until `funs` provides a function.

## .switchLatest()

Outputs the data from the latest stream in this stream-of-streams.

## .reduce(reducer,accumulator)

Using a (sync or async) `reducer` function which accepts the latest value of the
accumulator and a new value, returns the final value of the accumulator.

## .run()

Consumes this stream, throwing away values; returns a Promise.

The Promise will reject if the stream fails for any reason.

## .last()

Consumes this stream, returning its last value (or undefined if no value was
produced) inside a Promise.

    test('Retrieve the 14th BigInt', async t => {
      t.is(14n, await

        bigNaturals()
        .skip(1) // skip 0
        .first(14)
        .last()

      )
    })

## .equals(otherStream)
## .equals(otherStream,isEqual)

Consumes two streams; returns a Promise that is true if both stream yield
the same values.

The optional `isEqual` (sync or async) comparison function should return true if
its two arguments are considered equal.

# empty()

Builds a stream that finishes immediately.

# always(v)

Builds a stream that continously generates the value.

# bigNaturals()

Builds a stream that enumerates all positive BigInt values, starting at 0
and incrementing by 1 at each step.

# periodic(period)
# periodic(period,value)

Builds a stream that generates a new element with the provided value (or
undefined if no value is provided) and generates similarly every `period`
milliseconds thereafter.

# now(v)

Builds a stream that only produces once, with the value provided.

# throwError(e)

Builds a stream that stops immediately with the provided error.

# from(iterable)

From any iterable, generates a new "Lake" stream (described above).

The iterable might be an Array, an iterator, a ReadableStream, …

# equals(streamA,streamB)
# equals(streamA,streamB,isEqual)

From two Lake instances or two iterators, returns a boolean Promise indicating
whether the two suites are identical.

The optional (sync or async) `isEqual` function should return true to indicate
that its two arguments are considered identical.
