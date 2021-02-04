    sleep = (timeout) -> new Promise (resolve) -> setTimeout resolve, timeout

    class LakeAsyncIterator

      constructor: (@stream) ->

We can be used as a proxy for the iterator, turning it into an async iterator

      next: -> await @stream.next()

We also are an iterable

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

      skipRepeats: ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk unless chunk is last
            last = chunk
          return

      first: (max) ->
        {stream} = this
        Lake do ->
          n = 0n
          for await chunk from stream
            return if n++ >= max
            yield chunk
          return

      take: (n) -> @first n

      skip: (n) ->
        {stream} = this
        Lake do ->
          n = BigInt n
          for await chunk from stream
            return if n-- <= 0
            yield chunk
          return

      delay: (timeout) ->
        {stream} = this
        Lake do ->
          for await chunk from stream
            yield chunk
            await sleep timeout
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
          for await [chunk,index] from __merge stream, funs
            switch index
              when 0
                yield f? chunk
              when 1
                f = chunk
          return

      switchLatest: ->
        stream = this
        Lake do ->
          current = __merge stream
          while [chunk,index] = await current.next()
            switch index
              when 0
                current = __merge stream, chunk
              when 1
                yield chunk
          return

      join: ->


      reduce: (f,a) ->
        {stream} = this
        for await chunk from stream
          a = await f a, chunk
        return a

      run: ->
        {stream} = this
        for await chunk from stream
          no
        return


    Lake = (stream) -> new LakeAsyncIterator stream


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

No, grab the value to yield and queue up the next Then yield the value

          {value} = winner.result
          sources.set winner.stream, queueNext winner
          yield [value,winner.index]

Rotate the sources

        srcs.unshift srcs.pop()

      return

    merge = (streams...) ->
      for await [chunk] from mergeArray streams
        yield chunk
      return

    Empty = ->
      return

    Always = (v) ->
      while true
        yield v
      return

    BigNaturals = ->
      n = 0n
      while true
        yield n++
      return

    Periodic = (period) ->
      while true
        yield undefined
        await sleep period
      return

    Now = (v) ->
      yield v

    throwError = (error) ->
      throw error
      yield undefined

    Sum = (a,v) -> a+v

    no and do ->
      console.log await (
        (Lake Lake Lake do BigNaturals)
        .map (x) -> x*x
        .first 4n
        .forEach console.log
        .reduce Sum, 0n
      )

    do ->
      M = Lake merge (Lake do BigNaturals), (Lake do BigNaturals).map (x) -> -x
      console.log "Example 2", M
      await (Lake M)
        .forEach console.log
        .run()
      # console.log 'got', v for await v from M
      console.log "Exampl 2 started"
