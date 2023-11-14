export declare function sleep(timeout: number): Promise<void>;
type I<T> = AsyncIterator<T> | Iterator<T> | AsyncIterable<T> | Iterable<T>;
type P<T> = Promise<T> | T;
export declare class LakeAsyncIterator<T> implements AsyncIterable<T>, AsyncIterator<T> {
    private readonly iterator;
    constructor(stream: I<T>);
    next(): Promise<IteratorResult<T, any>>;
    [Symbol.asyncIterator](): LakeAsyncIterator<T>;
    map<U>(f: (v: T) => P<U>): LakeAsyncIterator<U>;
    concurrentMap<U>(atmost: number, fun: (v: T) => P<U>): LakeAsyncIterator<U>;
    constant(v: T): LakeAsyncIterator<T>;
    filter(predicate: (v: T) => P<boolean>): LakeAsyncIterator<T>;
    skipRepeats(eq?: (a: T, b: T | undefined) => P<boolean>): LakeAsyncIterator<T>;
    first(max: number | bigint): LakeAsyncIterator<T>;
    take(n: number | bigint): LakeAsyncIterator<T>;
    skip(n: number | bigint): LakeAsyncIterator<T>;
    delay(timeout: number): LakeAsyncIterator<T>;
    startWith(another: I<T>): LakeAsyncIterator<T>;
    continueWith(another: I<T>): LakeAsyncIterator<T>;
    forEach(f: (v: T) => P<void>): LakeAsyncIterator<T>;
    tap(f: (v: T) => P<void>): LakeAsyncIterator<T>;
    ap<U>(funs: I<(a: T) => P<U>>): LakeAsyncIterator<U>;
    switchLatest(): LakeAsyncIterator<T>;
    reduce<U>(f: (acc: U, value: T) => P<U>, a: U): Promise<U>;
    run(): Promise<void>;
    last(): Promise<T | undefined>;
    equals(otherStream: I<T>, eq?: (a: T, b: T) => P<boolean>): Promise<boolean>;
}
export declare const merge: (...streams: any[]) => LakeAsyncIterator<any>;
export declare function empty<T>(): LakeAsyncIterator<T>;
export declare function always<T>(v: T): LakeAsyncIterator<T>;
export declare function bigNaturals(): LakeAsyncIterator<bigint>;
export declare function periodic<undefined>(period: number, value?: never): LakeAsyncIterator<undefined>;
export declare function now<T>(v: T): LakeAsyncIterator<T>;
export declare function throwError<T, E extends Error>(e: E): LakeAsyncIterator<T>;
export declare function from<T>(a: I<T>): LakeAsyncIterator<T>;
export declare function equals<T>(A: I<T>, B: I<T>, eq: (a: T, b: T) => P<boolean>): Promise<boolean>;
export {};
//# sourceMappingURL=index.d.ts.map