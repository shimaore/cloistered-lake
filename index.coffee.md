    sleep = (timeout) -> new Promise (resolve) -> setTimeout resolve, timeout

An Async Iterator that behaves as a Readable Stream and supports Monadic Event
Stream patterns, using only native operators.

    class LakeAsyncIterator

      constructor: (@stream) ->

We can be used as a proxy for the original iterator, turning it into an async
iterator:

      next: -> await @stream.next()

We also are an async iterable, which means we can also be turned into a stream:

      [Symbol.asyncIterator]: -> return new LakeAsyncIterator this

      map: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield await f chunk
          return

      constant: (v) -> @map -> v

      filter: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk if await f chunk
          return

      skipRepeats: -> @skipRepeatsWith (a,b) -> a is b

      skipRepeatsWith: (equals) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk unless equals chunk, last
            last = chunk
          return

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

      skip: (n) ->
        {stream} = this
        n = BigInt n
        Lake do ->
          return if n <= 0
          for await chunk from stream
            if n-- <= 0
              yield chunk
          return

      delay: (timeout) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            await sleep timeout
            yield chunk
          return

      startWith: (another) ->
        {stream} = this
        Lake do ->
          for await chunk from another
            yield chunk
          for await chunk from stream
            yield chunk
          return

      continueWith: (another) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk
          for await chunk from another
            yield chunk
          return

      forEach: (f) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            await f chunk
            yield chunk
          return

      tap: (f) -> @forEach f

      ap: (funs) ->
        {stream} = this
        Lake do ->
          f = null
          for await [chunk,index] from mergeArray [stream, funs]
            switch index
              when 0
                yield f? chunk
              when 1
                f = chunk
          return

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

      reduce: (f,a) ->
        {stream} = this
        for await chunk from stream
          a = await f a, chunk
        return a

Consumes a stream, throwing away values; returns a Promise

      run: ->
        {stream} = this
        for await chunk from stream
          no
        return

Consumes two streams; returns a Promise that is true if both stream yield
the same values

      equals: (otherStream) -> equals this, otherStream

    export Lake = (stream) -> new LakeAsyncIterator stream

Based on https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
The main difference is that we rotate the sources list in order to help
Promise.race() make progress on all the streams, not just the first one.

Takes iterators or async iterators, returns an asyncIterator

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

Rotate the sources (forcing Promise.all to round-robin over them)

        srcs.unshift srcs.pop()

      return

    Merge = (streams...) ->
      for await [chunk] from mergeArray streams
        yield chunk
      return

    export merge = (streams...) -> Lake Merge streams...

    Empty = ->
      return

    export empty = -> Lake Empty()

    Always = (v) ->
      while true
        yield v
      return

    export always = -> Lake Always v

    BigNaturals = ->
      n = 0n
      while true
        yield n++
      return

    export bigNaturals = -> Lake BigNaturals()

    Periodic = (period) ->
      while true
        yield undefined
        await sleep period
      return

    export periodic = (period) -> Lake Periodic period

    Now = (v) ->
      yield v

    export now = (v) -> Lake Now v

    From = (a) ->
      for await v from a
        yield v
      return

    export from = (a) -> Lake From a

    ThrowError = (error) ->
      throw error
      yield undefined

    export throwError = (e) -> Lake ThrowError e

    export equals = (A,B) ->
      loop
        a = await A.next()
        b = await B.next()
        return true if a.done and b.done
        return false if a.done isnt b.done
        return false if a.value isnt b.value
      return
