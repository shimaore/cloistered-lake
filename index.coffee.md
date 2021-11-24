    export sleep = (timeout,value=undefined) -> new Promise (resolve) ->
      setTimeout (-> resolve value), timeout

    isIdentical = (a,b) -> a is b

# Lake(stream|iterator)

An Async Iterator that behaves as a Readable Stream and supports Monadic Event
Stream patterns, using only native operators.

    class LakeAsyncIterator

      constructor: (@stream) ->

It can be used as a proxy for the original (sync or async) iterator, turning it
into an async iterator.

      next: -> await @stream.next()

It also is an async iterable, which means it can be turned into a stream.

      [Symbol.asyncIterator]: -> new LakeAsyncIterator this

## .map(transform)

Applies a (sync or async) transformation function to each element in the stream.

      map: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield f chunk
          return

## .concurrentMap(atmost,transform)

Applies an async transformation function to each element in the stream, running
at most `atmost` instances concurrently.

The ordering of the elements is not guaranteed, since it will depend on the
evaluation time of the async `transform` function.

      concurrentMap: (atmost,fun) -> concurrentMap this.stream, atmost, fun

## .constant(value)

Transform this stream into a stream that produces the `value` for each element
the original stream produces.

      constant: (v) -> @map -> v

## .filter(fun)

Only forward stream values for which the (sync or async) `fun` function returns
(a Promise for) a truthy value.

      filter: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk if await f chunk
          return

## .skipRepeats()
## .skipRepeats(isEqual)

When successive values are identical, only the first one is propagated.

Optionally, a (sync or async) comparison function might be provided to compare
using a different criteria than `===`; it should return `true` if its two
arguments are considered identical.

      skipRepeats: (eq = isIdentical) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk unless await eq chunk, last
            last = chunk
          return

## .first(n)
## .take(n)

Only propagates the first `n` elements in the stream.

BigInt are used internally; `n` might be a integer or a BigInt.

      first: (max) ->
        {stream} = this
        n = 0n
        max = BigInt max
        Lake do ->
          return if n >= max
          for await chunk from stream
            return if n++ >= max
            yield chunk
          return

      take: (n) -> @first n

## .skip(n)

Skips the first `n` elements in the stream and only start propagating after the
`n`-th element has been received.

BigInt are used internally; `n` might be a integer or a BigInt.

      skip: (n) ->
        {stream} = this
        n = BigInt n
        Lake do ->
          return if n <= 0
          for await chunk from stream
            if n-- <= 0
              yield chunk
          return

## .delay(timeout)

Insert a delay of `timeout` milliseconds between each received element.

      delay: (timeout) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            await sleep timeout
            yield chunk
          return

## .startWith(otherStream)

Concatenates the otherStream with this stream.

      startWith: (another) ->
        {stream} = this
        Lake do ->
          for await chunk from another
            yield chunk
          for await chunk from stream
            yield chunk
          return

## .continueWith(otherStream)

Contatenates this stream then the otherStream.

      continueWith: (another) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk
          for await chunk from another
            yield chunk
          return

## .forEach(func)
## .tap(func)

Executes the (sync or async) `func` function for each element in the stream.
The stream is unmodified but might be delayed by the execution time of `func`.
The stream will fail if `func` fails or rejects.

      forEach: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            await f chunk
            yield chunk
          return

      tap: (f) -> @forEach f

## .ap(funs)

Apply a stream of (sync or async) functions to this stream.

Elements of this stream are dropped until `funs` provides a function.

      ap: (funs) ->
        {stream} = this
        Lake do ->
          f = null
          for await [chunk,index] from mergeArray [stream, funs]
            switch index
              when 0
                yield await f chunk if f?
              when 1
                f = chunk
          return

## .switchLatest()

Outputs the data from the latest stream in this stream-of-streams.

      switchLatest: ->
        stream = this
        Lake do ->
          current = mergeArray [stream]
          while [chunk,index] = await current.next()
            switch index
              when 0
                current = mergeArray [stream, chunk]
              when 1
                yield chunk
          return

## .reduce(reducer,accumulator)

Using a (sync or async) `reducer` function which accepts the last value of the
accumulator and a new value, returns the final value of the accumulator.

      reduce: (f,a) ->
        {stream} = this
        for await chunk from stream
          a = await f a, chunk
        return a

## .run()

Consumes this stream, throwing away values; returns a Promise.

The Promise will reject if the stream fails for any reason.

      run: ->
        {stream} = this
        for await chunk from stream
          no
        return

## .equals(otherStream)
## .equals(otherStream,isEqual)

Consumes two streams; returns a Promise that is true if both stream yield
the same values.

The optional `isEqual` (sync or async) comparison function should return true if
its two arguments are considered equal.

      equals: (otherStream,eq = isIdentical) -> equals this, otherStream, eq

    export Lake = (stream) -> new LakeAsyncIterator stream

# Merge stream

Based on https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
The main difference is that we rotate the sources list in order to help
Promise.race() make progress on all the streams, not just the first one.

Takes iterators or async iterators, returns an asyncIterator

    #* @param streams: asyncIterator[]
    #* @return asyncIterator

    mergeArray = (streams) ->

      queueNext = (e) ->
        e.result = null # Release previous one as soon as possible
        e.result = await e.stream.next()
        e

Map the generators to source objects in a map, get and start their first iteration.

      sources = new Map streams.map (stream,index) ->
        [
          stream,
          queueNext { stream, index, result: null }
        ]

      srcs = Array.from sources.values()

While we still have any sources, race the current promise of the sources we have left

      while sources.size
        winner = await Promise.race srcs

Completed the sequence?

        if winner.result.done

Yes, drop it from sources

          sources.delete winner.stream
          srcs = Array.from sources.values()

        else

No, grab the value to yield and queue up the next

          {value} = winner.result
          sources.set winner.stream, queueNext winner

Then yield the value and the index of the stream it came from
(the index in the index in the original `streams` parameter array).

          yield [value,winner.index]

Rotate the sources (forcing Promise.race to round-robin over them)

        srcs.unshift srcs.pop()

      return

    Merge = (streams...) ->
      for await [chunk] from mergeArray streams
        yield chunk
      return

    export merge = (streams...) -> Lake Merge streams...

## Concurrent execution

From a stream that generates Promises, keep at most N concurrent
Promises underway; generates a new stream that returns the values in
non-deterministic order

    #* @param stream: AsyncIterable<Promise>
    #* @param atmost : integer

    concurrentize = (stream,atmost,fun) ->

      pool = new Map
      index = 0n
      done = false

      completed = 0n

      nextKey = ->
        index += 1n
        index.toString()

      awaitNext = (key,next) ->
        result = await next
        if !result.done
          result.value = await fun result.value
        { key, result }

      loop

While there is still room in the pool, keep consuming values from the source.

        while not done and pool.size < atmost
          key = nextKey()
          pool.set key, awaitNext key, stream.next()

Return once the pool has been flushed

        if pool.size is 0
          return

The stream will fail if any of the Promises fail.

        pick = await Promise.race pool.values()
        pool.delete pick.key

        if pick.result.done
          done = true
        else
          completed++
          yield pick.result.value

      return

    ConcurrentMap = (stream,atmost,fun) ->
      for await value from concurrentize stream, atmost, fun
        yield value
      return

    export concurrentMap = (stream,atmost,fun) -> Lake ConcurrentMap stream, atmost, fun

# empty()

Builds a stream that finishes immediately.

    Empty = ->
      return

    export empty = -> Lake Empty()

# always(v)

Builds a stream that continously generates the value.

    Always = (v) ->
      while true
        yield v
      return

    export always = -> Lake Always v

# bigNaturals()

Builds a stream that enumerates all positive BigInt values, starting at 0
and incrementing by 1 at each step.

    BigNaturals = ->
      n = 0n
      while true
        yield n++
      return

    export bigNaturals = -> Lake BigNaturals()

# periodic(period)
# periodic(period,value)

Builds a stream that generates a new element with the provided value (or
undefined if no value is provided) and geneates similarly every `period`
milliseconds thereafter.

    Periodic = (period,value=undefined) ->
      while true
        yield value
        await sleep period
      return

    export periodic = (period) -> Lake Periodic period

# now(v)

Builds a stream that only produces once, with the value provided.

    Now = (v) ->
      yield v

    export now = (v) -> Lake Now v

# throwError(e)

Builds a stream that stops immediately with the provided error.

    ThrowError = (error) ->
      throw error
      yield undefined

    export throwError = (e) -> Lake ThrowError e

# from(iterable)

From any iterable, generates a new "Lake" stream (described above).

The iterable might be an Array, an iterator, a ReadableStream, …

    From = (a) ->
      for await v from a
        yield v
      return

    export from = (a) -> Lake From a

# equals(streamA,streamB)
# equals(streamA,streamB,isEqual)

From two Lake instances or two iterators, returns a boolean Promise indicating
whether the two suites are identical.

The optional (sync or async) `isEqual` function should return true to indicate
that its two arguments are considered identical.

    export equals = (A,B,eq = isIdentical) ->
      loop
        a = await A.next()
        b = await B.next()
        return true if a.done and b.done
        return false if a.done isnt b.done
        return false if not await eq a.value, b.value
      return
