type I<T> = AsyncIterable<T> | Iterable<T>
type P<T> = Promise<T> | T

declare class LakeAsyncIterator<T> {
  constructor(stream:I<T>);
  // is an Async Generator
  next(): Promise<{ done: boolean, value: T }>;
  // is an AsyncIterable
  [Symbol.asyncIterator](): LakeAsyncIterator<T>
  map<U>( f: (v:T) => P<U> ): LakeAsyncIterator<U>
  concurrentMap<U>( atmost: number, f: (v:T) => P<U> ): LakeAsyncIterator<U>
  constant(v:T): LakeAsyncIterator<T>
  filter(f: (v:T) => P<boolean>): LakeAsyncIterator<T>
  skipRepeast(isEqual?: (a:T,b:T) => P<T>): LakeAsyncIterator<T>
  first(n:number|bigint): LakeAsyncIterator<T>
  take(n:number|bigint): LakeAsyncIterator<T>
  skip(n:number|bigint): LakeAsyncIterator<T>
  delay(timeout:number): LakeAsyncIterator<T>
  startWith(otherStream: I<T>): LakeAsyncIterator<T>
  continueWith(otherStream: I<T>): LakeAsyncIterator<T>
  forEach(f: (v:T) => P<void>): LakeAsyncIterator<T>
  tap(f: (v:T) => P<void>): LakeAsyncIterator<T>
  ap<U>(funs:I<(a:T) => P<U>>): LakeAsyncIterator<U>
  switchLatest(): LakeAsyncIterator<T>
  reduce<U>( reducer: (acc:U,value:T) => P<U>, initialValue: U ): Promise<U>
  run(): Promise<void>
  last(): Promise<T|undefined>
  equals(otherStream:I<T>,isEqual?: (a:T,b:T) => P<boolean>): Promise<boolean>
}
export function sleep<T>(timeout: number, value?: T): Promise<T>;
export function Lake<T>(stream: I<T>): LakeAsyncIterator<T>;
export function merge(...streams: any[]): any;
export function concurrentMap(stream: any, atmost: any, fun: any): any;
export function empty<T>(): LakeAsyncIterator<T>;
export function always<T>(): LakeAsyncIterator<T>;
export function bigNaturals(): LakeAsyncIterator<bigint>;
export function periodic<T>(period: T): LakeAsyncIterator<T>;
export function now<T>(v: T): LakeAsyncIterator<T>;
export function throwError<T,E>(e: E): LakeAsyncIterator<T>;
export function from<T>(a: I<T>): LakeAsyncIterator<T>;
export function equals<T>(A: I<T>, B: I<T>, eq?: (a:T,b:T) => P<boolean>): Promise<boolean>;
