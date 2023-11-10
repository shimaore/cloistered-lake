var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var cloistered_lake_exports = {};
__export(cloistered_lake_exports, {
  LakeAsyncIterator: () => LakeAsyncIterator,
  always: () => always,
  bigNaturals: () => bigNaturals,
  empty: () => empty,
  equals: () => equals,
  from: () => from,
  merge: () => merge,
  now: () => now,
  periodic: () => periodic,
  sleep: () => sleep,
  throwError: () => throwError
});
module.exports = __toCommonJS(cloistered_lake_exports);
function sleep(timeout) {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeout);
  });
}
const isIdentical = function(a, b) {
  return a === b;
};
class LakeAsyncIterator {
  constructor(stream) {
    if (Symbol.asyncIterator in stream && typeof stream[Symbol.asyncIterator] === "function") {
      this.iterator = stream[Symbol.asyncIterator]();
      return;
    }
    if (Symbol.iterator in stream && typeof stream[Symbol.iterator] === "function") {
      this.iterator = stream[Symbol.iterator]();
      return;
    }
    if ("next" in stream && typeof stream.next === "function") {
      this.iterator = stream;
      return;
    }
    throw new Error("Stream is not an AsyncIterable, an Iterable, an AsyncIterator, nor an Iterator");
  }
  // It is an Async Generator
  // It can be used as a proxy for the original (sync or async) iterable, turning it into an async iterator.
  async next() {
    return await this.iterator.next();
  }
  // It is an AsyncIterable
  // It also is an async iterable, which means it can be turned back into a stream.
  [Symbol.asyncIterator]() {
    return this;
  }
  // ## .map(transform)
  // Applies a (sync or async) transformation function to each element in the stream.
  map(f) {
    const stream = this;
    const generator = async function* () {
      for await (const chunk of stream) {
        yield f(chunk);
      }
    };
    return from(generator());
  }
  // ## .concurrentMap(atmost,transform)
  // Applies an async transformation function to each element in the stream, running
  // at most `atmost` instances concurrently.
  // The ordering of the elements is not guaranteed, since it will depend on the
  // evaluation time of the async `transform` function.
  concurrentMap(atmost, fun) {
    return concurrentMap(this, atmost, fun);
  }
  // ## .constant(value)
  // Transform this stream into a stream that produces the `value` for each element
  // the original stream produces.
  constant(v) {
    return this.map(() => v);
  }
  filter(predicate) {
    const stream = this;
    const generator = async function* () {
      for await (const chunk of stream) {
        if (await predicate(chunk)) {
          yield chunk;
        }
      }
    };
    return from(generator());
  }
  // ## .skipRepeats()
  // ## .skipRepeats(isEqual)
  // When successive values are identical, only the first one is propagated.
  // Optionally, a (sync or async) comparison function might be provided to compare
  // using a different criteria than `===`; it should return `true` if its two
  // arguments are considered identical.
  skipRepeats(eq) {
    const equals2 = eq ?? isIdentical;
    const stream = this;
    const generator = async function* () {
      var last;
      for await (const chunk of stream) {
        if (!await equals2(chunk, last)) {
          yield chunk;
        }
        last = chunk;
      }
    };
    return from(generator());
  }
  // ## .first(n)
  // ## .take(n)
  // Only propagates the first `n` elements in the stream.
  // BigInt are used internally; `n` might be a integer or a BigInt.
  first(max) {
    const stream = this;
    var n = 0n;
    max = BigInt(max);
    const generator = async function* () {
      if (n >= max) {
        return;
      }
      for await (const chunk of stream) {
        if (n++ >= max) {
          return;
        }
        yield chunk;
      }
    };
    return from(generator());
  }
  take(n) {
    return this.first(n);
  }
  // ## .skip(n)
  // Skips the first `n` elements in the stream and only start propagating after the
  // `n`-th element has been received.
  // BigInt are used internally; `n` might be a integer or a BigInt.
  skip(n) {
    const stream = this;
    n = BigInt(n);
    const generator = async function* () {
      if (n <= 0) {
        return;
      }
      for await (const chunk of stream) {
        if (n-- <= 0) {
          yield chunk;
        }
      }
    };
    return from(generator());
  }
  // ## .delay(timeout)
  // Insert a delay of `timeout` milliseconds between each received element.
  delay(timeout) {
    const stream = this;
    const generator = async function* () {
      for await (const chunk of stream) {
        await sleep(timeout);
        yield chunk;
      }
    };
    return from(generator());
  }
  // ## .startWith(otherStream)
  // Concatenates the otherStream with this stream.
  startWith(another) {
    const stream = this;
    const otherStream = new LakeAsyncIterator(another);
    return from(async function* () {
      for await (const chunk of otherStream) {
        yield chunk;
      }
      for await (const chunk of stream) {
        yield chunk;
      }
    }());
  }
  // ## .continueWith(otherStream)
  // Contatenates this stream then the otherStream.
  continueWith(another) {
    const stream = this;
    const otherStream = new LakeAsyncIterator(another);
    return from(async function* () {
      for await (const chunk of stream) {
        yield chunk;
      }
      for await (const chunk of otherStream) {
        yield chunk;
      }
    }());
  }
  // ## .forEach(func)
  // ## .tap(func)
  // Executes the (sync or async) `func` function for each element in the stream.
  // The stream is unmodified but might be delayed by the execution time of `func`.
  // The stream will fail if `func` fails or rejects.
  forEach(f) {
    const stream = this;
    return from(async function* () {
      for await (const chunk of stream) {
        await f(chunk);
        yield chunk;
      }
    }());
  }
  tap(f) {
    return this.forEach(f);
  }
  // ## .ap(funs)
  // Apply a stream of (sync or async) functions to this stream.
  // Elements of this stream are dropped until `funs` provides a function.
  ap(funs) {
    const stream = this;
    return from(async function* () {
      var f = null;
      const ref = mergeArray([stream, funs]);
      for await (const x of ref) {
        const [chunk, index] = x;
        switch (index) {
          case 0:
            if (f != null) {
              yield await f(chunk);
            }
            break;
          case 1:
            f = chunk;
        }
      }
    }());
  }
  // ## .switchLatest()
  // Outputs the data from the latest stream in this stream-of-streams.
  switchLatest() {
    const stream = this;
    return from(async function* () {
      var chunk, index;
      var current = mergeArray([stream]);
      while ([chunk, index] = await current.next()) {
        switch (index) {
          case 0:
            current = mergeArray([stream, chunk]);
            break;
          case 1:
            yield chunk;
        }
      }
    }());
  }
  // ## .reduce(reducer,accumulator)
  // Using a (sync or async) `reducer` function which accepts the latest value of the
  // accumulator and a new value, returns the final value of the accumulator.
  async reduce(f, a) {
    const stream = this;
    for await (const chunk of stream) {
      a = await f(a, chunk);
    }
    return a;
  }
  // ## .run()
  // Consumes this stream, throwing away values; returns a Promise.
  // The Promise will reject if the stream fails for any reason.
  async run() {
    const stream = this;
    for await (const chunk of stream) {
      false;
    }
  }
  // ## .last()
  // Consumes this stream, returning its last value (or undefined if no value was
  // produced) inside a Promise.
  async last() {
    const stream = this;
    var last = void 0;
    for await (const chunk of stream) {
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
  equals(otherStream, eq) {
    eq ??= isIdentical;
    return equals(this, otherStream, eq);
  }
}
const mergeArray = async function* (streams) {
  const queueNext = async function(e) {
    e.result = null;
    e.result = await e.stream.next();
    return e;
  };
  const sources = new Map(streams.map(function(stream, index) {
    return [
      stream,
      queueNext({
        stream,
        index,
        result: null
      })
    ];
  }));
  var srcs = Array.from(sources.values());
  while (sources.size) {
    const winner = await Promise.race(srcs);
    if (winner.result.done) {
      sources.delete(winner.stream);
      srcs = Array.from(sources.values());
    } else {
      const { value } = winner.result;
      sources.set(winner.stream, queueNext(winner));
      yield [value, winner.index];
    }
    const nextSrc = srcs.pop();
    if (nextSrc) {
      srcs.unshift(nextSrc);
    }
  }
};
const Merge = async function* (...streams) {
  const ref = mergeArray(streams);
  for await (const x of ref) {
    const [chunk] = x;
    yield chunk;
  }
};
const merge = function(...streams) {
  return from(Merge(...streams));
};
const concurrentize = async function* (stream, atmost, fun) {
  const pool = /* @__PURE__ */ new Map();
  let index = 0n;
  let done = false;
  let completed = 0n;
  const nextKey = function() {
    index++;
    return index.toString();
  };
  const awaitNext = async function(key, next) {
    const result = await next;
    if (!result.done) {
      result.value = await fun(result.value);
    }
    return { key, result };
  };
  while (true) {
    while (!done && pool.size < atmost) {
      const key = nextKey();
      pool.set(key, awaitNext(key, stream.next()));
    }
    if (pool.size === 0) {
      return;
    }
    const pick = await Promise.race(pool.values());
    pool.delete(pick.key);
    if (pick.result.done) {
      done = true;
    } else {
      completed++;
      yield pick.result.value;
    }
  }
};
const ConcurrentMap = async function* (stream, atmost, fun) {
  const ref = concurrentize(stream, atmost, fun);
  for await (const value of ref) {
    yield value;
  }
};
const concurrentMap = function(stream, atmost, fun) {
  return from(ConcurrentMap(stream, atmost, fun));
};
const Empty = async function* () {
  const ref = [];
  for await (const value of ref) {
    yield value;
  }
};
function empty() {
  return from(Empty());
}
const Always = function* (v) {
  while (true) {
    yield v;
  }
};
function always(v) {
  return from(Always(v));
}
const BigNaturals = function* () {
  var n = 0n;
  while (true) {
    yield n++;
  }
};
function bigNaturals() {
  return from(BigNaturals());
}
const Periodic = async function* (period, value) {
  while (true) {
    yield value;
    await sleep(period);
  }
};
function periodic(period, value) {
  return from(Periodic(period, value));
}
;
const Now = function* (v) {
  return yield v;
};
function now(v) {
  return from(Now(v));
}
;
const ThrowError = async function* (error) {
  return Promise.reject(error);
};
function throwError(e) {
  return from(ThrowError(e));
}
function from(a) {
  return new LakeAsyncIterator(a);
}
async function equals(A, B, eq) {
  const equals2 = eq ?? isIdentical;
  const lakeA = from(A);
  const lakeB = from(B);
  while (true) {
    const a = await lakeA.next();
    const b = await lakeB.next();
    if (a.done && b.done) {
      return true;
    }
    if (a.done !== b.done) {
      return false;
    }
    if (!await eq(a.value, b.value)) {
      return false;
    }
  }
}
