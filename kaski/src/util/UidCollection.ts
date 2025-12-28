/**
 * UidCollection - Generic ID-based object collection
 *
 * Manages objects by unique integer IDs.
 * Used throughout HLE for threads, files, callbacks, memory partitions, etc.
 */

/**
 * UidCollection - Maps unique integer IDs to objects
 */
export class UidCollection<T>
{
  private items: Map<number, T> = new Map();
  private nextUid: number;
  private freeUids: number[] = [];

  constructor(private startUid: number = 1)
  {
    this.nextUid = startUid;
  }

  /**
   * Get the next available UID without allocating
   * (for when you need to create an object with the UID first)
   */
  nextId(): number
  {
    if (this.freeUids.length > 0)
    {
      return this.freeUids[this.freeUids.length - 1];
    }
    return this.nextUid;
  }

  /**
   * Set an item at a UID (creates or replaces)
   */
  set(uid: number, item: T): void
  {
    this.items.set(uid, item);
    if (uid >= this.nextUid)
    {
      this.nextUid = uid + 1;
    }
    // Remove from free list if present
    const freeIdx = this.freeUids.indexOf(uid);
    if (freeIdx !== -1)
    {
      this.freeUids.splice(freeIdx, 1);
    }
  }

  /**
   * Allocate a new UID for an item
   */
  allocate(item: T): number
  {
    const uid = this.freeUids.length > 0
      ? this.freeUids.pop()!
      : this.nextUid++;

    this.items.set(uid, item);
    return uid;
  }

  /**
   * Allocate with a specific UID (for preallocated IDs)
   */
  allocateAt(uid: number, item: T): void
  {
    if (this.items.has(uid))
    {
      throw new Error(`UID ${uid} already allocated`);
    }
    this.items.set(uid, item);
    if (uid >= this.nextUid)
    {
      this.nextUid = uid + 1;
    }
  }

  /**
   * Get item by UID
   */
  get(uid: number): T | undefined
  {
    return this.items.get(uid);
  }

  /**
   * Get item by UID or throw
   */
  getOrThrow(uid: number, errorMsg?: string): T
  {
    const item = this.items.get(uid);
    if (item === undefined)
    {
      throw new Error(errorMsg ?? `Invalid UID: ${uid}`);
    }
    return item;
  }

  /**
   * Check if UID exists
   */
  has(uid: number): boolean
  {
    return this.items.has(uid);
  }

  /**
   * Release a UID
   */
  release(uid: number): boolean
  {
    if (!this.items.delete(uid))
    {
      return false;
    }
    this.freeUids.push(uid);
    return true;
  }

  /**
   * Remove item and return it
   */
  remove(uid: number): T | undefined
  {
    const item = this.items.get(uid);
    if (item !== undefined)
    {
      this.release(uid);
    }
    return item;
  }

  /**
   * Find UID by item
   */
  findUid(item: T): number | undefined
  {
    for (const [uid, stored] of this.items)
    {
      if (stored === item)
      {
        return uid;
      }
    }
    return undefined;
  }

  /**
   * Find item by predicate
   */
  find(predicate: (item: T) => boolean): T | undefined
  {
    for (const item of this.items.values())
    {
      if (predicate(item))
      {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Filter items by predicate
   */
  filter(predicate: (item: T) => boolean): T[]
  {
    const result: T[] = [];
    for (const item of this.items.values())
    {
      if (predicate(item))
      {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get all items
   */
  values(): IterableIterator<T>
  {
    return this.items.values();
  }

  /**
   * Get all entries
   */
  entries(): IterableIterator<[number, T]>
  {
    return this.items.entries();
  }

  /**
   * Iterate over all items with their UIDs
   */
  forEach(callback: (item: T, uid: number) => void): void
  {
    this.items.forEach((item, uid) => callback(item, uid));
  }

  /**
   * Number of items
   */
  get size(): number
  {
    return this.items.size;
  }

  /**
   * Clear all items
   */
  clear(): void
  {
    this.items.clear();
    this.freeUids = [];
    this.nextUid = this.startUid;
  }
}
