var Always, BigNaturals, ConcurrentMap, Empty, From, LakeAsyncIterator, Merge, Now, Periodic, ThrowError, concurrentize, isIdentical, mergeArray;

export var sleep = function(timeout, value = void 0) {
  return new Promise(function(resolve) {
    return setTimeout((function() {
      return resolve(value);
    }), timeout);
  });
};

isIdentical = function(a, b) {
  return a === b;
};

// # Lake(stream|iterator)

  // An Async Iterator that behaves as a Readable Stream and supports Monadic Event
// Stream patterns, using only native operators.
LakeAsyncIterator = class LakeAsyncIterator {
  constructor(stream1) {
    this.stream = stream1;
  }

  // It can be used as a proxy for the original (sync or async) iterator, turning it
  // into an async iterator.
  async next() {
    return (await this.stream.next());
  }

  // It also is an async iterable, which means it can be turned into a stream.
  [Symbol.asyncIterator]() {
    return new LakeAsyncIterator(this);
  }

  // ## .map(transform)

    // Applies a (sync or async) transformation function to each element in the stream.
  map(f) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        yield f(chunk);
      }
    })());
  }

  // ## .concurrentMap(atmost,transform)

    // Applies an async transformation function to each element in the stream, running
  // at most `atmost` instances concurrently.

    // The ordering of the elements is not guaranteed, since it will depend on the
  // evaluation time of the async `transform` function.
  concurrentMap(atmost, fun) {
    return concurrentMap(this.stream, atmost, fun);
  }

  // ## .constant(value)

    // Transform this stream into a stream that produces the `value` for each element
  // the original stream produces.
  constant(v) {
    return this.map(function() {
      return v;
    });
  }

  // ## .filter(fun)

    // Only forward stream values for which the (sync or async) `fun` function returns
  // (a Promise for) a truthy value.
  filter(f) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        if ((await f(chunk))) {
          yield chunk;
        }
      }
    })());
  }

  // ## .skipRepeats()
  // ## .skipRepeats(isEqual)

    // When successive values are identical, only the first one is propagated.

    // Optionally, a (sync or async) comparison function might be provided to compare
  // using a different criteria than `===`; it should return `true` if its two
  // arguments are considered identical.
  skipRepeats(eq = isIdentical) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk, last;
      for await (chunk of stream) {
        if (!(await eq(chunk, last))) {
          yield chunk;
        }
        last = chunk;
      }
    })());
  }

  // ## .first(n)
  // ## .take(n)

    // Only propagates the first `n` elements in the stream.

    // BigInt are used internally; `n` might be a integer or a BigInt.
  first(max) {
    var n, stream;
    ({stream} = this);
    n = 0n;
    max = BigInt(max);
    return Lake((async function*() {
      var chunk;
      if (n >= max) {
        return;
      }
      for await (chunk of stream) {
        if (n++ >= max) {
          return;
        }
        yield chunk;
      }
    })());
  }

  take(n) {
    return this.first(n);
  }

  // ## .skip(n)

    // Skips the first `n` elements in the stream and only start propagating after the
  // `n`-th element has been received.

    // BigInt are used internally; `n` might be a integer or a BigInt.
  skip(n) {
    var stream;
    ({stream} = this);
    n = BigInt(n);
    return Lake((async function*() {
      var chunk;
      if (n <= 0) {
        return;
      }
      for await (chunk of stream) {
        if (n-- <= 0) {
          yield chunk;
        }
      }
    })());
  }

  // ## .delay(timeout)

    // Insert a delay of `timeout` milliseconds between each received element.
  delay(timeout) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        await sleep(timeout);
        yield chunk;
      }
    })());
  }

  // ## .startWith(otherStream)

    // Concatenates the otherStream with this stream.
  startWith(another) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of another) {
        yield chunk;
      }
      for await (chunk of stream) {
        yield chunk;
      }
    })());
  }

  // ## .continueWith(otherStream)

    // Contatenates this stream then the otherStream.
  continueWith(another) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        yield chunk;
      }
      for await (chunk of another) {
        yield chunk;
      }
    })());
  }

  // ## .forEach(func)
  // ## .tap(func)

    // Executes the (sync or async) `func` function for each element in the stream.
  // The stream is unmodified but might be delayed by the execution time of `func`.
  // The stream will fail if `func` fails or rejects.
  forEach(f) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        await f(chunk);
        yield chunk;
      }
    })());
  }

  tap(f) {
    return this.forEach(f);
  }

  // ## .ap(funs)

    // Apply a stream of (sync or async) functions to this stream.

    // Elements of this stream are dropped until `funs` provides a function.
  ap(funs) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk, f, index, ref, x;
      f = null;
      ref = mergeArray([stream, funs]);
      for await (x of ref) {
        [chunk, index] = x;
        switch (index) {
          case 0:
            if (f != null) {
              yield (await f(chunk));
            }
            break;
          case 1:
            f = chunk;
        }
      }
    })());
  }

  // ## .switchLatest()

    // Outputs the data from the latest stream in this stream-of-streams.
  switchLatest() {
    var stream;
    stream = this;
    return Lake((async function*() {
      var chunk, current, index;
      current = mergeArray([stream]);
      while ([chunk, index] = (await current.next())) {
        switch (index) {
          case 0:
            current = mergeArray([stream, chunk]);
            break;
          case 1:
            yield chunk;
        }
      }
    })());
  }

  // ## .reduce(reducer,accumulator)

    // Using a (sync or async) `reducer` function which accepts the last value of the
  // accumulator and a new value, returns the final value of the accumulator.
  async reduce(f, a) {
    var chunk, stream;
    ({stream} = this);
    for await (chunk of stream) {
      a = (await f(a, chunk));
    }
    return a;
  }

  // ## .run()

    // Consumes this stream, throwing away values; returns a Promise.

    // The Promise will reject if the stream fails for any reason.
  async run() {
    var chunk, stream;
    ({stream} = this);
    for await (chunk of stream) {
      false;
    }
  }

  // ## .last()

    // Consumes this stream, returning its last value (or undefined if no value was
  // produced) inside a Promise.
  async last() {
    var chunk, last, stream;
    ({stream} = this);
    last = void 0;
    for await (chunk of stream) {
      last = chunk;
    }
    return last;
  }

  // ## .equals(otherStream)
  // ## .equals(otherStream,isEqual)

    // Consumes two streams; returns a Promise that is true if both stream yield
  // the same values.

    // The optional `isEqual` (sync or async) comparison function should return true if
  // its two arguments are considered equal.
  equals(otherStream, eq = isIdentical) {
    return equals(this, otherStream, eq);
  }

};

export var Lake = function(stream) {
  return new LakeAsyncIterator(stream);
};

// # Merge stream

// Based on https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
// The main difference is that we rotate the sources list in order to help
// Promise.race() make progress on all the streams, not just the first one.

// Takes iterators or async iterators, returns an asyncIterator

//* @param streams: asyncIterator[]
//* @return asyncIterator
mergeArray = async function*(streams) {
  var queueNext, sources, srcs, value, winner;
  queueNext = async function(e) {
    e.result = null; // Release previous one as soon as possible
    e.result = (await e.stream.next());
    return e;
  };
  // Map the generators to source objects in a map, get and start their first iteration.
  sources = new Map(streams.map(function(stream, index) {
    return [
      stream,
      queueNext({
        stream,
        index,
        result: null
      })
    ];
  }));
  srcs = Array.from(sources.values());
  // While we still have any sources, race the current promise of the sources we have left
  while (sources.size) {
    winner = (await Promise.race(srcs));
    // Completed the sequence?
    if (winner.result.done) {
      // Yes, drop it from sources
      sources.delete(winner.stream);
      srcs = Array.from(sources.values());
    } else {
      // No, grab the value to yield and queue up the next
      ({value} = winner.result);
      sources.set(winner.stream, queueNext(winner));
      // Then yield the value and the index of the stream it came from
      // (the index in the index in the original `streams` parameter array).
      yield [value, winner.index];
    }
    // Rotate the sources (forcing Promise.race to round-robin over them)
    srcs.unshift(srcs.pop());
  }
};

Merge = async function*(...streams) {
  var chunk, ref, x;
  ref = mergeArray(streams);
  for await (x of ref) {
    [chunk] = x;
    yield chunk;
  }
};

export var merge = function(...streams) {
  return Lake(Merge(...streams));
};

// ## Concurrent execution

// From a stream that generates Promises, keep at most N concurrent
// Promises underway; generates a new stream that returns the values in
// non-deterministic order

//* @param stream: AsyncIterable<Promise>
//* @param atmost : integer
concurrentize = async function*(stream, atmost, fun) {
  var awaitNext, completed, done, index, key, nextKey, pick, pool;
  pool = new Map();
  index = 0n;
  done = false;
  completed = 0n;
  nextKey = function() {
    index += 1n;
    return index.toString();
  };
  awaitNext = async function(key, next) {
    var result;
    result = (await next);
    if (!result.done) {
      result.value = (await fun(result.value));
    }
    return {key, result};
  };
  while (true) {
    // While there is still room in the pool, keep consuming values from the source.
    while (!done && pool.size < atmost) {
      key = nextKey();
      pool.set(key, awaitNext(key, stream.next()));
    }
    // Return once the pool has been flushed
    if (pool.size === 0) {
      return;
    }
    // The stream will fail if any of the Promises fail.
    pick = (await Promise.race(pool.values()));
    pool.delete(pick.key);
    if (pick.result.done) {
      done = true;
    } else {
      completed++;
      yield pick.result.value;
    }
  }
};

ConcurrentMap = async function*(stream, atmost, fun) {
  var ref, value;
  ref = concurrentize(stream, atmost, fun);
  for await (value of ref) {
    yield value;
  }
};

export var concurrentMap = function(stream, atmost, fun) {
  return Lake(ConcurrentMap(stream, atmost, fun));
};

// # empty()

// Builds a stream that finishes immediately.
Empty = function() {};

export var empty = function() {
  return Lake(Empty());
};

// # always(v)

// Builds a stream that continously generates the value.
Always = function*(v) {
  while (true) {
    yield v;
  }
};

export var always = function() {
  return Lake(Always(v));
};

// # bigNaturals()

// Builds a stream that enumerates all positive BigInt values, starting at 0
// and incrementing by 1 at each step.
BigNaturals = function*() {
  var n;
  n = 0n;
  while (true) {
    yield n++;
  }
};

export var bigNaturals = function() {
  return Lake(BigNaturals());
};

// # periodic(period)
// # periodic(period,value)

// Builds a stream that generates a new element with the provided value (or
// undefined if no value is provided) and geneates similarly every `period`
// milliseconds thereafter.
Periodic = async function*(period, value = void 0) {
  while (true) {
    yield value;
    await sleep(period);
  }
};

export var periodic = function(period) {
  return Lake(Periodic(period));
};

// # now(v)

// Builds a stream that only produces once, with the value provided.
Now = function*(v) {
  return (yield v);
};

export var now = function(v) {
  return Lake(Now(v));
};

// # throwError(e)

// Builds a stream that stops immediately with the provided error.
ThrowError = function*(error) {
  throw error;
  return (yield void 0);
};

export var throwError = function(e) {
  return Lake(ThrowError(e));
};

// # from(iterable)

// From any iterable, generates a new "Lake" stream (described above).

// The iterable might be an Array, an iterator, a ReadableStream, …
From = async function*(a) {
  var v;
  for await (v of a) {
    yield v;
  }
};

export var from = function(a) {
  return Lake(From(a));
};

// # equals(streamA,streamB)
// # equals(streamA,streamB,isEqual)

// From two Lake instances or two iterators, returns a boolean Promise indicating
// whether the two suites are identical.

// The optional (sync or async) `isEqual` function should return true to indicate
// that its two arguments are considered identical.
export var equals = async function(A, B, eq = isIdentical) {
  var a, b;
  while (true) {
    a = (await A.next());
    b = (await B.next());
    if (a.done && b.done) {
      return true;
    }
    if (a.done !== b.done) {
      return false;
    }
    if (!(await eq(a.value, b.value))) {
      return false;
    }
  }
};
