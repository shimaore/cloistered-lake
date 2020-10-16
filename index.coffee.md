    Lake = (stream) ->
      next: -> stream.next()

      map: (f) ->
        Lake do ->
          for await chunk from stream
            yield await f chunk
          return

      filter: (f) ->
        Lake do ->
          for await chunk from stream
            yield chunk if await f chunk
          return

      forEach: (f) ->
        Lake do ->
          for await chunk from stream
            await f chunk
            yield chunk
          return

      first: (max) ->
        Lake do ->
          n = 0n
          for await chunk from stream
            return if n++ >= max
            yield chunk
          return

      reduce: (f,a) ->
        for await chunk from stream
          a = await f a, chunk
        return a

    merge = (stream1,stream2) ->
      Lake do ->
        p1done = false
        p2done = false
        until p1done and p2done
          unless p1done
            p1 = stream1.next()

            # Sync generator
            if p1.value?
              yield p1.value
              p1done = p1.done
              p1 = null

          unless p2done
            p2 = stream2.next()

            # Sync generator
            if p2.value?
              yield p2.value
              p2done = p2.done
              p2 = null

          # WIP
          if p1?
            p1 = await p1
            yield p1.value
            p1done = p1.done
            p1 = null

          if p2?
            p2 = await p2
            yield p2.value
            p2done = p1.done
            p2 = null

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

    Sum = (a,v) -> a+v

    do ->
      console.log await (
        (Lake do BigNaturals)
        .map (x) -> x*x
        .first 4n
        .forEach console.log
        .reduce Sum, 0n
      )

    do ->
      Lake merge(
        (do BigNaturals),
        (Lake do BigNaturals).map (x) -> -x
      )
      .forEach console.log
