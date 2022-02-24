var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, copyDefault, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && (copyDefault || key !== "default"))
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toCommonJS = /* @__PURE__ */ ((cache) => {
  return (module2, temp) => {
    return cache && cache.get(module2) || (temp = __reExport(__markAsModule({}), module2, 1), cache && cache.set(module2, temp), temp);
  };
})(typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : 0);
var cloistered_lake_exports = {};
__export(cloistered_lake_exports, {
  Lake: () => Lake,
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
var Always, BigNaturals, ConcurrentMap, Empty, From, LakeAsyncIterator, Merge, Now, Periodic, ThrowError, concurrentMap, concurrentize, isIdentical, mergeArray;
var sleep = function(timeout, value = void 0) {
  return new Promise(function(resolve) {
    return setTimeout(function() {
      return resolve(value);
    }, timeout);
  });
};
isIdentical = function(a, b) {
  return a === b;
};
LakeAsyncIterator = class LakeAsyncIterator2 {
  constructor(stream1) {
    this.stream = stream1;
  }
  async next() {
    return await this.stream.next();
  }
  [Symbol.asyncIterator]() {
    return new LakeAsyncIterator2(this);
  }
  map(f) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of stream) {
        yield f(chunk);
      }
    }());
  }
  concurrentMap(atmost, fun) {
    return concurrentMap(this.stream, atmost, fun);
  }
  constant(v2) {
    return this.map(function() {
      return v2;
    });
  }
  filter(f) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of stream) {
        if (await f(chunk)) {
          yield chunk;
        }
      }
    }());
  }
  skipRepeats(eq = isIdentical) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk, last;
      for await (chunk of stream) {
        if (!await eq(chunk, last)) {
          yield chunk;
        }
        last = chunk;
      }
    }());
  }
  first(max) {
    var n, stream;
    ({ stream } = this);
    n = 0n;
    max = BigInt(max);
    return Lake(async function* () {
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
    }());
  }
  take(n) {
    return this.first(n);
  }
  skip(n) {
    var stream;
    ({ stream } = this);
    n = BigInt(n);
    return Lake(async function* () {
      var chunk;
      if (n <= 0) {
        return;
      }
      for await (chunk of stream) {
        if (n-- <= 0) {
          yield chunk;
        }
      }
    }());
  }
  delay(timeout) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of stream) {
        await sleep(timeout);
        yield chunk;
      }
    }());
  }
  startWith(another) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of another) {
        yield chunk;
      }
      for await (chunk of stream) {
        yield chunk;
      }
    }());
  }
  continueWith(another) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of stream) {
        yield chunk;
      }
      for await (chunk of another) {
        yield chunk;
      }
    }());
  }
  forEach(f) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk;
      for await (chunk of stream) {
        await f(chunk);
        yield chunk;
      }
    }());
  }
  tap(f) {
    return this.forEach(f);
  }
  ap(funs) {
    var stream;
    ({ stream } = this);
    return Lake(async function* () {
      var chunk, f, index, ref, x;
      f = null;
      ref = mergeArray([stream, funs]);
      for await (x of ref) {
        [chunk, index] = x;
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
  switchLatest() {
    var stream;
    stream = this;
    return Lake(async function* () {
      var chunk, current, index;
      current = mergeArray([stream]);
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
  async reduce(f, a) {
    var chunk, stream;
    ({ stream } = this);
    for await (chunk of stream) {
      a = await f(a, chunk);
    }
    return a;
  }
  async run() {
    var chunk, stream;
    ({ stream } = this);
    for await (chunk of stream) {
      false;
    }
  }
  async last() {
    var chunk, last, stream;
    ({ stream } = this);
    last = void 0;
    for await (chunk of stream) {
      last = chunk;
    }
    return last;
  }
  equals(otherStream, eq = isIdentical) {
    return equals(this, otherStream, eq);
  }
};
var Lake = function(stream) {
  return new LakeAsyncIterator(stream);
};
mergeArray = async function* (streams) {
  var queueNext, sources, srcs, value, winner;
  queueNext = async function(e) {
    e.result = null;
    e.result = await e.stream.next();
    return e;
  };
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
  while (sources.size) {
    winner = await Promise.race(srcs);
    if (winner.result.done) {
      sources.delete(winner.stream);
      srcs = Array.from(sources.values());
    } else {
      ({ value } = winner.result);
      sources.set(winner.stream, queueNext(winner));
      yield [value, winner.index];
    }
    srcs.unshift(srcs.pop());
  }
};
Merge = async function* (...streams) {
  var chunk, ref, x;
  ref = mergeArray(streams);
  for await (x of ref) {
    [chunk] = x;
    yield chunk;
  }
};
var merge = function(...streams) {
  return Lake(Merge(...streams));
};
concurrentize = async function* (stream, atmost, fun) {
  var awaitNext, completed, done, index, key, nextKey, pick, pool;
  pool = /* @__PURE__ */ new Map();
  index = 0n;
  done = false;
  completed = 0n;
  nextKey = function() {
    index += 1n;
    return index.toString();
  };
  awaitNext = async function(key2, next) {
    var result;
    result = await next;
    if (!result.done) {
      result.value = await fun(result.value);
    }
    return { key: key2, result };
  };
  while (true) {
    while (!done && pool.size < atmost) {
      key = nextKey();
      pool.set(key, awaitNext(key, stream.next()));
    }
    if (pool.size === 0) {
      return;
    }
    pick = await Promise.race(pool.values());
    pool.delete(pick.key);
    if (pick.result.done) {
      done = true;
    } else {
      completed++;
      yield pick.result.value;
    }
  }
};
ConcurrentMap = async function* (stream, atmost, fun) {
  var ref, value;
  ref = concurrentize(stream, atmost, fun);
  for await (value of ref) {
    yield value;
  }
};
concurrentMap = function(stream, atmost, fun) {
  return Lake(ConcurrentMap(stream, atmost, fun));
};
Empty = async function* () {
  var ref, value;
  ref = [];
  for await (value of ref) {
    yield value;
  }
};
var empty = function() {
  return Lake(Empty());
};
Always = function* (v2) {
  while (true) {
    yield v2;
  }
};
var always = function() {
  return Lake(Always(v));
};
BigNaturals = function* () {
  var n;
  n = 0n;
  while (true) {
    yield n++;
  }
};
var bigNaturals = function() {
  return Lake(BigNaturals());
};
Periodic = async function* (period, value = void 0) {
  while (true) {
    yield value;
    await sleep(period);
  }
};
var periodic = function(period) {
  return Lake(Periodic(period));
};
Now = function* (v2) {
  return yield v2;
};
var now = function(v2) {
  return Lake(Now(v2));
};
ThrowError = function* (error) {
  throw error;
  return yield void 0;
};
var throwError = function(e) {
  return Lake(ThrowError(e));
};
From = async function* (a) {
  var v2;
  for await (v2 of a) {
    yield v2;
  }
};
var from = function(a) {
  return Lake(From(a));
};
var equals = async function(A, B, eq = isIdentical) {
  var a, b;
  while (true) {
    a = await A.next();
    b = await B.next();
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
};
module.exports = __toCommonJS(cloistered_lake_exports);
