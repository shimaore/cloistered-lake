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

    import {Lake} from '@shimaore/lake';
    Lake( process.stdin );

and with Node.js' Writeable Stream API, using [`pipeline`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_stream_pipeline_streams_callback) or [`Readable.from`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_stream_readable_from_iterable_options):

    import {pipeline} from 'stream';
    import fs from 'fs';
    import {bigNaturals} from '@shimaore/lake';
    pipeline(
      bigNaturals().skip(1).map( x => x*x ).first(1000).map( x => `${x}\n` ),
      // This will create a file containing the first thousand squares
      fs.createWriteStream('thousand-squares.txt'),
      console.error
    );

Basic iteration
===============

Some basic data streaming example, first one building integers (positive and
negative) from naturals (positive only):

    import {merge,from} from '@shimaore/lake'

    const BigIntegers = merge(
      bigNaturals().skip(1),
      bigNaturals().map( x => -x ),
    );

    const firstTwentyIntegers = from(
      [0,-1,1,-2,2,-3,3,-4,4,-5,5,-6,6,-7,7,-8,8,-9,9,-10].map(BigInt)
    )

    import assert from 'assert';
    (async function() {
    assert(await

      BigIntegers
      .first(20)

      .equals( firstTwentyIntegers )

    )})()

Notice how `first` and `equals` are methods on the stream.


Another example, building the sum of the first 1000 squares in constant space:

    const Sum = (a,v) => a+v

    (async function() {
      assert.equal( 333_833_500n, await (

        (Lake(Lake(bigNaturals())))
        .skip(1)
        .map( x => x*x )
        .first(1000n)
        .reduce(Sum, 0n)

      ))
    })()


