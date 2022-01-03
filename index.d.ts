declare class LakeAsyncIterator<T> {
  constructor(stream:AsyncIterable<T>|Iterable<T>);
  // is an Async Generator
  next(): Promise<{ done: boolean, value: T }>;
  // is an AsyncIterable
  [Symbol.asyncIterator](): LakeAsyncIterator<T>
  map<U>( f: (v:T) => U ): LakeAsyncIterator<U>
  concurrentMap<U>( atmost: number, f: (v:T) => U ): LakeAsyncIterator<U>
  constant(v:T): LakeAsyncIterator<T>
  filter(f: (v:T) => boolean): LakeAsyncIterator<T>
  skipRepeast(isEqual?: (a:T,b:T) => Promise<boolean> | boolean): LakeAsyncIterator<T>
  first(n:number|BigInt): LakeAsyncIterator<T>
  take(n:number|BigInt): LakeAsyncIterator<T>
  skip(n:number|BigInt): LakeAsyncIterator<T>
  delay(timeout:number): LakeAsyncIterator<T>
  startWith(otherStream: AsyncIterable<T> | Iterable<T>): LakeAsyncIterator<T>
  continueWith(otherStream: AsyncIterable<T> | Iterable<T>): LakeAsyncIterator<T>
  forEach(f: (v:T) => void): LakeAsyncIterator<T>
  tap(f: (v:T) => void): LakeAsyncIterator<T>
  ap<U>(funs:AsyncIterable<(a:T) => U>|Iterable<(a:T) => U>): LakeAsyncIterator<U>
  switchLatest(): LakeAsyncIterator<T>
  reduce<U>( reducer: (acc:U,value:T) => U, initialValue: T ): AsyncGenerator<U>
  run(): Promise<void>
  last(): Promise<T|undefined>
  equals(otherStream:AsyncIterable<T>,isEqual?: (a:T,b:T) => Promise<boolean> | boolean): AsyncGenerator<T>
}
export function sleep<T>(timeout: number, value?: T): Promise<T>;
export function Lake<T>(stream: AsyncIterable<T> | Iterable<T>): LakeAsyncIterator<T>;
export function merge(...streams: any[]): any;
export function concurrentMap(stream: any, atmost: any, fun: any): any;
export function empty<T>(): LakeAsyncIterator<T>;
export function always<T>(): LakeAsyncIterator<T>;
export function bigNaturals(): LakeAsyncIterator<BigInt>;
export function periodic<T>(period: T): LakeAsyncIterator<T>;
export function now<T>(v: T): LakeAsyncIterator<T>;
export function throwError<T,E>(e: E): LakeAsyncIterator<T>;
export function from<T>(a: AsyncIterable<T> | Iterable<T>): LakeAsyncIterator<T>;
export function equals(A: any, B: any, eq?: any): Promise<boolean>;
