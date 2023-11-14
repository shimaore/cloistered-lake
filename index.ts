export function sleep(timeout: number) : Promise<void> {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeout)
  })
}

const isIdentical = function<T>(a:T, b:T) : P<boolean> {
  return a === b;
}

type I<T> = AsyncIterator<T> | Iterator<T> | AsyncIterable<T> | Iterable<T>
type P<T> = Promise<T> | T

// An Async Iterator that behaves as a Readable Stream and supports Monadic Event
// Stream patterns, using only native operators.
export class LakeAsyncIterator<T> implements AsyncIterable<T>, AsyncIterator<T> {
  private readonly iterator: AsyncIterator<T> | Iterator<T>

  constructor(stream: I<T>) {
    // AsyncIterable
    if (Symbol.asyncIterator in stream && typeof stream[Symbol.asyncIterator] === 'function') {
      this.iterator = stream[Symbol.asyncIterator]()
      return
    }
    // Iterable
    if (Symbol.iterator in stream && typeof stream[Symbol.iterator] === 'function') {
      this.iterator = stream[Symbol.iterator]()
      return
    }
    // AsyncIterator or Iterator
    if ('next' in stream && typeof stream.next === 'function') {
      this.iterator = stream
      return
    }
    throw new Error('Stream is not an AsyncIterable, an Iterable, an AsyncIterator, nor an Iterator')
  }

  // It is an Async Generator
  // It can be used as a proxy for the original (sync or async) iterable, turning it into an async iterator.
  async next(): Promise<IteratorResult<T, any>> {
    return await this.iterator.next()
  }

  // It is an AsyncIterable
  // It also is an async iterable, which means it can be turned back into a stream.
  [Symbol.asyncIterator](): LakeAsyncIterator<T> {
    return this;
  }

  // ## .map(transform)

  // Applies a (sync or async) transformation function to each element in the stream.
  map<U>(f: (v:T) => P<U>): LakeAsyncIterator<U> {
    const stream = this
    const generator = async function*() {
      for await (const chunk of stream) {
        yield f(chunk);
      }
   }
    return from(generator());
  }

  // ## .concurrentMap(atmost,transform)

  // Applies an async transformation function to each element in the stream, running
  // at most `atmost` instances concurrently.

  // The ordering of the elements is not guaranteed, since it will depend on the
  // evaluation time of the async `transform` function.
  concurrentMap<U>(atmost: number, fun: (v:T) => P<U>): LakeAsyncIterator<U> {
    return concurrentMap(this, atmost, fun);
  }

  // ## .constant(value)

  // Transform this stream into a stream that produces the `value` for each element
  // the original stream produces.
  constant(v:T): LakeAsyncIterator<T> {
    return this.map(() => v)
  }

  // ## .filter(fun)

  // Only forward stream values for which the (sync or async) `fun` function returns
  // (a Promise for) a truthy value.
  filter(predicate: (v:T) => P<boolean>): LakeAsyncIterator<T>
  filter<U>(predicate: (value:unknown) => value is U): LakeAsyncIterator<U>
  {
    const stream = this
    const generator = async function*() {
      for await (const chunk of stream) {
        if (await predicate(chunk)) {
          yield chunk as U;
        }
      }
    }
    return from(generator());
  }

  // ## .skipRepeats()
  // ## .skipRepeats(isEqual)

  // When successive values are identical, only the first one is propagated.

  // Optionally, a (sync or async) comparison function might be provided to compare
  // using a different criteria than `===`; it should return `true` if its two
  // arguments are considered identical.
  skipRepeats(eq?: (a:T,b:T|undefined) => P<boolean>): LakeAsyncIterator<T> {
    const equals : (a:T,b:T|undefined) => P<boolean> = eq ?? isIdentical
    const stream = this
    const generator = async function*() {
      var last
      for await (const chunk of stream) {
        if (!(await equals(chunk, last))) {
          yield chunk;
        }
        last = chunk;
      }
    }
    return from(generator())
  }

  // ## .first(n)
  // ## .take(n)

  // Only propagates the first `n` elements in the stream.

  // BigInt are used internally; `n` might be a integer or a BigInt.
  first(max:number|bigint): LakeAsyncIterator<T> {
    const stream = this
    var n = 0n;
    max = BigInt(max);
    const generator = async function*() {
      if (n >= max) {
        return;
      }
      for await (const chunk of stream) {
        if (n++ >= max) {
          return;
        }
        yield chunk;
      }
    }
    return from(generator());
  }

  take(n:number|bigint): LakeAsyncIterator<T> {
    return this.first(n);
  }

  // ## .skip(n)

  // Skips the first `n` elements in the stream and only start propagating after the
  // `n`-th element has been received.

  // BigInt are used internally; `n` might be a integer or a BigInt.
  skip(n:number|bigint): LakeAsyncIterator<T> {
    const stream = this
    n = BigInt(n);
    const generator = async function*() {
      if (n <= 0) {
        return;
      }
      for await (const chunk of stream) {
        if (n-- <= 0) {
          yield chunk;
        }
      }
    }
    return from(generator());
  }

  // ## .delay(timeout)

  // Insert a delay of `timeout` milliseconds between each received element.
  delay(timeout:number): LakeAsyncIterator<T> {
    const stream = this
    const generator = async function*() {
      for await (const chunk of stream) {
        await sleep(timeout);
        yield chunk;
      }
    }
    return from(generator());
  }

  // ## .startWith(otherStream)

  // Concatenates the otherStream with this stream.
  startWith(another: I<T>): LakeAsyncIterator<T> {
    const stream = this
    const otherStream = new LakeAsyncIterator(another)
    return from((async function*() {
      for await (const chunk of otherStream) {
        yield chunk;
      }
      for await (const chunk of stream) {
        yield chunk;
      }
    })());
  }

  // ## .continueWith(otherStream)

  // Contatenates this stream then the otherStream.
  continueWith(another: I<T>): LakeAsyncIterator<T> {
    const stream = this
    const otherStream = new LakeAsyncIterator(another)
    return from((async function*() {
      for await (const chunk of stream) {
        yield chunk;
      }
      for await (const chunk of otherStream) {
        yield chunk;
      }
    })());
  }

  // ## .forEach(func)
  // ## .tap(func)

  // Executes the (sync or async) `func` function for each element in the stream.
  // The stream is unmodified but might be delayed by the execution time of `func`.
  // The stream will fail if `func` fails or rejects.
  forEach(f: (v:T) => P<void>): LakeAsyncIterator<T> {
    const stream = this
    return from((async function*() {
      for await (const chunk of stream) {
        await f(chunk);
        yield chunk;
      }
    })());
  }

  tap(f: (v:T) => P<void>): LakeAsyncIterator<T> {
    return this.forEach(f);
  }

  // ## .ap(funs)

  // Apply a stream of (sync or async) functions to this stream.

  // Elements of this stream are dropped until `funs` provides a function.
  ap<U>(funs:I<(a:T) => P<U>>): LakeAsyncIterator<U> {
    const stream = this
    return from((async function*() {
      var f = null;
      const ref = mergeArray([stream, funs]);
      for await (const x of ref) {
        const [chunk, index] = x;
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
  switchLatest(): LakeAsyncIterator<T> {
    const stream = this
    return from((async function*() {
      // FIXME any
      var chunk : any, index : number;
      // FIXME any
      var current : any = mergeArray([stream]);
      while ([chunk, index] = await current.next()) {
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

  // Using a (sync or async) `reducer` function which accepts the latest value of the
  // accumulator and a new value, returns the final value of the accumulator.
  async reduce<U>(f: (acc:U,value:T) => P<U>, a: U): Promise<U> {
    const stream = this
    for await (const chunk of stream) {
      a = (await f(a, chunk));
    }
    return a;
  }

  // ## .run()

  // Consumes this stream, throwing away values; returns a Promise.

  // The Promise will reject if the stream fails for any reason.
  async run(): Promise<void> {
    const stream = this
    for await (const chunk of stream) {
      false;
    }
  }

  // ## .last()

  // Consumes this stream, returning its last value (or undefined if no value was
  // produced) inside a Promise.
  async last(): Promise<T|undefined> {
    const stream = this
    var last = undefined;
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
  equals(otherStream:I<T>, eq?: (a:T,b:T) => P<boolean>): Promise<boolean> {
    eq ??= isIdentical
    return equals(this, otherStream, eq)
  }

}

// # Merge stream

// Based on https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables
// The main difference is that we rotate the sources list in order to help
// Promise.race() make progress on all the streams, not just the first one.

// Takes iterators or async iterators, returns an asyncIterator

//* @param streams: asyncIterator[]
//* @return asyncIterator
const mergeArray = async function*(streams: I<any>[]) : AsyncGenerator<[any,number],void,unknown> {
  // FIXME any any
  const queueNext = async function(e: { stream: any, index: number, result: any }) {
    e.result = null; // Release previous one as soon as possible
    e.result = (await e.stream.next());
    return e;
  };
  // Map the generators to source objects in a map, get and start their first iteration.
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
  // While we still have any sources, race the current promise of the sources we have left
  while (sources.size) {
    const winner = (await Promise.race(srcs));
    // Completed the sequence?
    if (winner.result.done) {
      // Yes, drop it from sources
      sources.delete(winner.stream);
      srcs = Array.from(sources.values());
    } else {
      // No, grab the value to yield and queue up the next
      const {value} = winner.result;
      sources.set(winner.stream, queueNext(winner));
      // Then yield the value and the index of the stream it came from
      // (the index in the index in the original `streams` parameter array).
      yield [value, winner.index];
    }
    // Rotate the sources (forcing Promise.race to round-robin over them)
    const nextSrc = srcs.pop()
    if (nextSrc) {
      srcs.unshift(nextSrc);
    }
  }
}

const Merge = async function*(...streams : I<any>[]) : AsyncGenerator<any,void,unknown> {
  const ref = mergeArray(streams);
  for await (const x of ref) {
    const [chunk] = x;
    yield chunk;
  }
}

export const merge = function(...streams: any[]) {
  return from(Merge(...streams));
}

// ## Concurrent execution

// From a stream that generates Promises, keep at most N concurrent
// Promises underway; generates a new stream that returns the values in
// non-deterministic order

//* @param stream: AsyncIterable<Promise>
//* @param atmost : integer
// FIXME any any
const concurrentize = async function*<T>(stream: any, atmost:number, fun:(x:any) => P<T>) {
  const pool = new Map();
  let index = 0n;
  let done = false;
  let completed = 0n;
  const nextKey = function() : string {
    index++;
    return index.toString();
  };
  const awaitNext = async function(key:string, next:Promise<any>) {
    const result = (await next);
    if (!result.done) {
      result.value = (await fun(result.value));
    }
    return {key, result};
  };
  while (true) {
    // While there is still room in the pool, keep consuming values from the source.
    while (!done && pool.size < atmost) {
      const key = nextKey();
      pool.set(key, awaitNext(key, stream.next()));
    }
    // Return once the pool has been flushed
    if (pool.size === 0) {
      return;
    }
    // The stream will fail if any of the Promises fail.
    const pick = (await Promise.race(pool.values()));
    pool.delete(pick.key);
    if (pick.result.done) {
      done = true;
    } else {
      completed++;
      yield pick.result.value;
    }
  }
}

const ConcurrentMap = async function*(stream:any, atmost:number, fun:any) {
  const ref = concurrentize(stream, atmost, fun);
  for await (const value of ref) {
    yield value;
  }
}

const concurrentMap = function(stream:any, atmost:number, fun:any) {
  return from(ConcurrentMap(stream, atmost, fun));
}

// # empty()

// Builds a stream that finishes immediately.
const Empty = async function*<T>() {
  const ref : T[] = [];
  for await (const value of ref) {
    yield value;
  }
}

export function empty<T>(): LakeAsyncIterator<T> {
  return from(Empty())
}

// # always(v)

// Builds a stream that continously generates the value.
const Always = function*<T>(v:T) {
  while (true) {
    yield v;
  }
}

export function always<T>(v:T): LakeAsyncIterator<T> {
  return from(Always(v));
}

// # bigNaturals()

// Builds a stream that enumerates all positive BigInt values, starting at 0
// and incrementing by 1 at each step.
const BigNaturals = function*() {
  var n = 0n;
  while (true) {
    yield n++;
  }
}

export function bigNaturals(): LakeAsyncIterator<bigint> {
  return from(BigNaturals())
}

// # periodic(period)
// # periodic(period,value)

// Builds a stream that generates a new element with the provided value (or
// undefined if no value is provided) and generates similarly every `period`
// milliseconds thereafter.
const Periodic = async function*<T>(period:number, value:T) : AsyncGenerator<T> {
  while (true) {
    yield value;
    await sleep(period);
  }
}

export function periodic<undefined>(period:number, value?: never): LakeAsyncIterator<undefined>
export function periodic<T> (period:number, value: T): LakeAsyncIterator<T> {
  return from(Periodic(period,value));
};

// # now(v)

// Builds a stream that only produces once, with the value provided.
const Now = function*<T>(v:T) : Generator<T> {
  return (yield v);
};

export function now<T>(v:T): LakeAsyncIterator<T> {
  return from(Now(v));
};

// # throwError(e)

// Builds a stream that stops immediately with the provided error.
const ThrowError = async function*<T,E extends Error>(error:E) : AsyncGenerator<T> {
  return Promise.reject(error)
}

export function throwError<T,E extends Error>(e:E): LakeAsyncIterator<T> {
  return from(ThrowError(e));
}

// # from(iterable|asynciterable)

// From any iterable, generates a new "Lake" stream (described above).

// The iterable might be an Array, an iterator, an AsyncIterator,
// a [ReadableStream](https://nodejs.org/dist/latest/docs/api/stream.html#readablesymbolasynciterator), …

// Use Node.js' [`events.on(emitter,eventName)`](https://nodejs.org/dist/latest/docs/api/events.html#eventsonemitter-eventname-options)
// to create an AsyncIterator from an event-emitter.

export function from<T>(a: I<T>): LakeAsyncIterator<T> {
  return new LakeAsyncIterator(a);
}

// # equals(streamA,streamB)
// # equals(streamA,streamB,isEqual)

// From two Lake instances or two iterators, returns a boolean Promise indicating
// whether the two suites are identical.

// The optional (sync or async) `isEqual` function should return true to indicate
// that its two arguments are considered identical.
export async function equals<T>(A: I<T>, B: I<T>, eq: (a:T,b:T) => P<boolean>): Promise<boolean> {
  const equals = eq ?? isIdentical
  const lakeA = from(A)
  const lakeB = from(B)
  while (true) {
    const a = (await lakeA.next());
    const b = (await lakeB.next());
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
}
