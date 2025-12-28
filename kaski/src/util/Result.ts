/**
 * Result<T, E> - Type-safe error handling
 *
 * Rust-inspired Result type for operations that can fail.
 * Forces explicit error handling at compile time.
 */

/**
 * Result type - either Ok(value) or Err(error)
 */
export type Result<T, E = number> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Create a successful result
 */
export function Ok<T>(value: T): Result<T, never>
{
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): Result<never, E>
{
  return { ok: false, error };
}

/**
 * Check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T }
{
  return result.ok;
}

/**
 * Check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E }
{
  return !result.ok;
}

/**
 * Unwrap the value or throw
 */
export function unwrap<T, E>(result: Result<T, E>): T
{
  if (result.ok)
  {
    return result.value;
  }
  throw new Error(`Unwrap called on Err: ${result.error}`);
}

/**
 * Unwrap the value or return default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T
{
  return result.ok ? result.value : defaultValue;
}

/**
 * Unwrap the value or compute default
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T
{
  return result.ok ? result.value : fn(result.error);
}

/**
 * Unwrap the error or throw
 */
export function unwrapErr<T, E>(result: Result<T, E>): E
{
  if (!result.ok)
  {
    return result.error;
  }
  throw new Error(`UnwrapErr called on Ok: ${result.value}`);
}

/**
 * Map the Ok value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
{
  return result.ok ? Ok(fn(result.value)) : result;
}

/**
 * Map the Err value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
{
  return result.ok ? result : Err(fn(result.error));
}

/**
 * Chain Results (flatMap/andThen)
 */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>
{
  return result.ok ? fn(result.value) : result;
}

/**
 * Chain on error (orElse)
 */
export function orElse<T, E, F>(result: Result<T, E>, fn: (error: E) => Result<T, F>): Result<T, F>
{
  return result.ok ? result : fn(result.error);
}

/**
 * Pattern match on Result
 */
export function match<T, E, U>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => U
): U
{
  return result.ok ? onOk(result.value) : onErr(result.error);
}

/**
 * Convert nullable to Result
 */
export function fromNullable<T, E>(value: T | null | undefined, error: E): Result<T, E>
{
  return value != null ? Ok(value) : Err(error);
}

/**
 * Try a function that might throw
 */
export function tryCatch<T, E = Error>(fn: () => T, mapError?: (e: unknown) => E): Result<T, E>
{
  try
  {
    return Ok(fn());
  }
  catch (e)
  {
    return Err(mapError ? mapError(e) : e as E);
  }
}

/**
 * Combine multiple Results - all must succeed
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E>
{
  const values: T[] = [];
  for (const result of results)
  {
    if (!result.ok)
    {
      return result;
    }
    values.push(result.value);
  }
  return Ok(values);
}

/**
 * ResultAsync - Result that wraps a Promise
 */
export class ResultAsync<T, E = number>
{
  constructor(private readonly promise: Promise<Result<T, E>>) {}

  static fromPromise<T, E = Error>(
    promise: Promise<T>,
    mapError?: (e: unknown) => E
  ): ResultAsync<T, E>
  {
    return new ResultAsync(
      promise
        .then(value => Ok(value) as Result<T, E>)
        .catch(e => Err(mapError ? mapError(e) : e as E))
    );
  }

  static ok<T>(value: T): ResultAsync<T, never>
  {
    return new ResultAsync(Promise.resolve(Ok(value)));
  }

  static err<E>(error: E): ResultAsync<never, E>
  {
    return new ResultAsync(Promise.resolve(Err(error)));
  }

  then<U>(fn: (result: Result<T, E>) => U): Promise<U>
  {
    return this.promise.then(fn);
  }

  map<U>(fn: (value: T) => U): ResultAsync<U, E>
  {
    return new ResultAsync(this.promise.then(r => map(r, fn)));
  }

  mapErr<F>(fn: (error: E) => F): ResultAsync<T, F>
  {
    return new ResultAsync(this.promise.then(r => mapErr(r, fn)));
  }

  andThen<U>(fn: (value: T) => Result<U, E>): ResultAsync<U, E>
  {
    return new ResultAsync(this.promise.then(r => andThen(r, fn)));
  }

  andThenAsync<U>(fn: (value: T) => ResultAsync<U, E>): ResultAsync<U, E>
  {
    return new ResultAsync(
      this.promise.then(r =>
      {
        if (!r.ok) return r;
        return fn(r.value).promise;
      })
    );
  }

  match<U>(onOk: (value: T) => U, onErr: (error: E) => U): Promise<U>
  {
    return this.promise.then(r => match(r, onOk, onErr));
  }

  unwrapOr(defaultValue: T): Promise<T>
  {
    return this.promise.then(r => unwrapOr(r, defaultValue));
  }

  toPromise(): Promise<Result<T, E>>
  {
    return this.promise;
  }
}
