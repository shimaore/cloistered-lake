var Always, BigNaturals, Empty, From, LakeAsyncIterator, Merge, Now, Periodic, ThrowError, mergeArray, sleep;

sleep = function(timeout) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, timeout);
  });
};

// An Async Iterator that behaves as a Readable Stream and supports Monadic Event
// Stream patterns, using only native operators.
LakeAsyncIterator = class LakeAsyncIterator {
  constructor(stream1) {
    this.stream = stream1;
  }

  // We can be used as a proxy for the original iterator, turning it into an async
  // iterator:
  async next() {
    return (await this.stream.next());
  }

  // We also are an async iterable, which means we can also be turned into a stream:
  [Symbol.asyncIterator]() {
    return new LakeAsyncIterator(this);
  }

  map(f) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk;
      for await (chunk of stream) {
        yield (await f(chunk));
      }
    })());
  }

  constant(v) {
    return this.map(function() {
      return v;
    });
  }

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

  skipRepeats() {
    return this.skipRepeatsWith(function(a, b) {
      return a === b;
    });
  }

  skipRepeatsWith(equals) {
    var stream;
    ({stream} = this);
    return Lake((async function*() {
      var chunk, last;
      for await (chunk of stream) {
        if (!equals(chunk, last)) {
          yield chunk;
        }
        last = chunk;
      }
    })());
  }

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
            yield (typeof f === "function" ? f(chunk) : void 0);
            break;
          case 1:
            f = chunk;
        }
      }
    })());
  }

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

  async reduce(f, a) {
    var chunk, stream;
    ({stream} = this);
    for await (chunk of stream) {
      a = (await f(a, chunk));
    }
    return a;
  }

  // Consumes a stream, throwing away values; returns a Promise
  async run() {
    var chunk, stream;
    ({stream} = this);
    for await (chunk of stream) {
      false;
    }
  }

  // Consumes two streams; returns a Promise that is true if both stream yield
  // the same values
  equals(otherStream) {
    return equals(this, otherStream);
  }

};

export var Lake = function(stream) {
  return new LakeAsyncIterator(stream);
};

// Based on https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
// The main difference is that we rotate the sources list in order to help
// Promise.race() make progress on all the streams, not just the first one.

// Takes iterators or async iterators, returns an asyncIterator

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

Empty = function() {};

export var empty = function() {
  return Lake(Empty());
};

Always = function*(v) {
  while (true) {
    yield v;
  }
};

export var always = function() {
  return Lake(Always(v));
};

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

Periodic = async function*(period) {
  while (true) {
    yield void 0;
    await sleep(period);
  }
};

export var periodic = function(period) {
  return Lake(Periodic(period));
};

Now = function*(v) {
  return (yield v);
};

export var now = function(v) {
  return Lake(Now(v));
};

From = async function*(a) {
  var v;
  for await (v of a) {
    yield v;
  }
};

export var from = function(a) {
  return Lake(From(a));
};

ThrowError = function*(error) {
  throw error;
  return (yield void 0);
};

export var throwError = function(e) {
  return Lake(ThrowError(e));
};

export var equals = async function(A, B) {
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
    if (a.value !== b.value) {
      return false;
    }
  }
};
