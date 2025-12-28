/**
 * Memory VFS
 *
 * In-memory virtual file system.
 * Useful for testing and temporary files.
 */

import { PromiseFast } from '../../util/PromiseFast';
import {
  Vfs, VfsEntry, FileStat, DirEntry,
  OpenFlags, SeekMode, FileMode,
} from './types';

// ============================================
// Memory File Node
// ============================================

interface FileNode
{
  type: 'file' | 'directory';
  data?: Uint8Array;
  children?: Map<string, FileNode>;
  ctime: Date;
  mtime: Date;
  atime: Date;
}

// ============================================
// Memory VFS Entry
// ============================================

class MemoryVfsEntry implements VfsEntry
{
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly path: string;
  position: number = 0;

  private node: FileNode;
  private flags: OpenFlags;

  constructor(path: string, node: FileNode, flags: OpenFlags)
  {
    this.path = path;
    this.node = node;
    this.flags = flags;
    this.isFile = node.type === 'file';
    this.isDirectory = node.type === 'directory';

    // Handle append mode
    if ((flags & OpenFlags.Append) && node.data)
    {
      this.position = node.data.length;
    }
  }

  read(size: number): PromiseFast<Uint8Array>
  {
    if (!this.isFile || !this.node.data)
    {
      return PromiseFast.resolve(new Uint8Array(0));
    }

    const available = this.node.data.length - this.position;
    const toRead = Math.min(size, available);
    const data = this.node.data.slice(this.position, this.position + toRead);
    this.position += toRead;
    this.node.atime = new Date();

    return PromiseFast.resolve(data);
  }

  write(data: Uint8Array): PromiseFast<number>
  {
    if (!this.isFile)
    {
      return PromiseFast.resolve(0);
    }

    if (!(this.flags & OpenFlags.Write))
    {
      return PromiseFast.resolve(0);
    }

    const current = this.node.data ?? new Uint8Array(0);
    const endPosition = this.position + data.length;

    if (endPosition > current.length)
    {
      // Expand file
      const newData = new Uint8Array(endPosition);
      newData.set(current);
      newData.set(data, this.position);
      this.node.data = newData;
    }
    else
    {
      current.set(data, this.position);
    }

    this.position = endPosition;
    this.node.mtime = new Date();

    return PromiseFast.resolve(data.length);
  }

  seek(offset: number, mode: SeekMode): PromiseFast<number>
  {
    if (!this.isFile)
    {
      return PromiseFast.resolve(0);
    }

    const size = this.node.data?.length ?? 0;

    switch (mode)
    {
      case SeekMode.Set:
        this.position = offset;
        break;
      case SeekMode.Current:
        this.position += offset;
        break;
      case SeekMode.End:
        this.position = size + offset;
        break;
    }

    // Clamp position
    this.position = Math.max(0, this.position);

    return PromiseFast.resolve(this.position);
  }

  getSize(): PromiseFast<number>
  {
    return PromiseFast.resolve(this.node.data?.length ?? 0);
  }

  stat(): PromiseFast<FileStat>
  {
    return PromiseFast.resolve({
      mode: this.isDirectory ? FileMode.Directory : FileMode.File,
      size: this.node.data?.length ?? 0,
      atime: this.node.atime,
      mtime: this.node.mtime,
      ctime: this.node.ctime,
    });
  }

  close(): PromiseFast<void>
  {
    return PromiseFast.resolve();
  }

  readDir(): PromiseFast<DirEntry[]>
  {
    if (!this.isDirectory || !this.node.children)
    {
      return PromiseFast.resolve([]);
    }

    const entries: DirEntry[] = [];
    for (const [name, child] of this.node.children)
    {
      entries.push({
        name,
        stat: {
          mode: child.type === 'directory' ? FileMode.Directory : FileMode.File,
          size: child.data?.length ?? 0,
          atime: child.atime,
          mtime: child.mtime,
          ctime: child.ctime,
        },
      });
    }

    return PromiseFast.resolve(entries);
  }
}

// ============================================
// Memory VFS
// ============================================

/**
 * In-memory Virtual File System
 */
export class MemoryVfs implements Vfs
{
  readonly name = 'memory';

  private root: FileNode;

  constructor()
  {
    const now = new Date();
    this.root = {
      type: 'directory',
      children: new Map(),
      ctime: now,
      mtime: now,
      atime: now,
    };
  }

  /**
   * Reset to empty state
   */
  reset(): void
  {
    const now = new Date();
    this.root = {
      type: 'directory',
      children: new Map(),
      ctime: now,
      mtime: now,
      atime: now,
    };
  }

  /**
   * Add a file with content
   */
  addFile(path: string, data: Uint8Array | string): void
  {
    const content = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;

    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName) return;

    const parent = this.ensureDirectory(parts);
    const now = new Date();

    parent.children!.set(fileName, {
      type: 'file',
      data: content,
      ctime: now,
      mtime: now,
      atime: now,
    });
  }

  /**
   * Get file content
   */
  getFile(path: string): Uint8Array | null
  {
    const node = this.getNode(path);
    if (!node || node.type !== 'file')
    {
      return null;
    }
    return node.data ?? null;
  }

  private parsePath(path: string): string[]
  {
    return path.split('/').filter(p => p.length > 0);
  }

  private getNode(path: string): FileNode | null
  {
    const parts = this.parsePath(path);
    let current = this.root;

    for (const part of parts)
    {
      if (current.type !== 'directory' || !current.children)
      {
        return null;
      }
      const next = current.children.get(part);
      if (!next)
      {
        return null;
      }
      current = next;
    }

    return current;
  }

  private ensureDirectory(parts: string[]): FileNode
  {
    let current = this.root;

    for (const part of parts)
    {
      if (!current.children)
      {
        current.children = new Map();
      }

      let next = current.children.get(part);
      if (!next)
      {
        const now = new Date();
        next = {
          type: 'directory',
          children: new Map(),
          ctime: now,
          mtime: now,
          atime: now,
        };
        current.children.set(part, next);
      }
      current = next;
    }

    return current;
  }

  open(path: string, flags: OpenFlags): PromiseFast<VfsEntry | null>
  {
    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName)
    {
      return PromiseFast.resolve(null);
    }

    const parent = this.getNode(parts.join('/'));
    if (!parent || parent.type !== 'directory')
    {
      return PromiseFast.resolve(null);
    }

    let node = parent.children?.get(fileName);

    if (!node)
    {
      if (!(flags & OpenFlags.Create))
      {
        return PromiseFast.resolve(null);
      }

      // Create new file
      const now = new Date();
      node = {
        type: 'file',
        data: new Uint8Array(0),
        ctime: now,
        mtime: now,
        atime: now,
      };
      parent.children!.set(fileName, node);
    }

    if (node.type !== 'file')
    {
      return PromiseFast.resolve(null);
    }

    // Handle truncate
    if ((flags & OpenFlags.Truncate) && node.data)
    {
      node.data = new Uint8Array(0);
      node.mtime = new Date();
    }

    return PromiseFast.resolve(new MemoryVfsEntry(path, node, flags));
  }

  openDir(path: string): PromiseFast<VfsEntry | null>
  {
    const node = path === '' || path === '/'
      ? this.root
      : this.getNode(path);

    if (!node || node.type !== 'directory')
    {
      return PromiseFast.resolve(null);
    }

    return PromiseFast.resolve(new MemoryVfsEntry(path, node, OpenFlags.Read));
  }

  stat(path: string): PromiseFast<FileStat | null>
  {
    const node = this.getNode(path);
    if (!node)
    {
      return PromiseFast.resolve(null);
    }

    return PromiseFast.resolve({
      mode: node.type === 'directory' ? FileMode.Directory : FileMode.File,
      size: node.data?.length ?? 0,
      atime: node.atime,
      mtime: node.mtime,
      ctime: node.ctime,
    });
  }

  exists(path: string): PromiseFast<boolean>
  {
    return PromiseFast.resolve(this.getNode(path) !== null);
  }

  mkdir(path: string): PromiseFast<boolean>
  {
    const parts = this.parsePath(path);
    const dirName = parts.pop();
    if (!dirName)
    {
      return PromiseFast.resolve(false);
    }

    const parent = this.getNode(parts.join('/')) ?? this.root;
    if (parent.type !== 'directory')
    {
      return PromiseFast.resolve(false);
    }

    if (parent.children?.has(dirName))
    {
      return PromiseFast.resolve(false);
    }

    const now = new Date();
    if (!parent.children)
    {
      parent.children = new Map();
    }
    parent.children.set(dirName, {
      type: 'directory',
      children: new Map(),
      ctime: now,
      mtime: now,
      atime: now,
    });

    return PromiseFast.resolve(true);
  }

  remove(path: string): PromiseFast<boolean>
  {
    const parts = this.parsePath(path);
    const fileName = parts.pop();
    if (!fileName)
    {
      return PromiseFast.resolve(false);
    }

    const parent = parts.length > 0 ? this.getNode(parts.join('/')) : this.root;
    if (!parent || parent.type !== 'directory')
    {
      return PromiseFast.resolve(false);
    }

    const node = parent.children?.get(fileName);
    if (!node || node.type !== 'file')
    {
      return PromiseFast.resolve(false);
    }

    parent.children!.delete(fileName);
    return PromiseFast.resolve(true);
  }

  rmdir(path: string): PromiseFast<boolean>
  {
    const parts = this.parsePath(path);
    const dirName = parts.pop();
    if (!dirName)
    {
      return PromiseFast.resolve(false);
    }

    const parent = parts.length > 0 ? this.getNode(parts.join('/')) : this.root;
    if (!parent || parent.type !== 'directory')
    {
      return PromiseFast.resolve(false);
    }

    const node = parent.children?.get(dirName);
    if (!node || node.type !== 'directory')
    {
      return PromiseFast.resolve(false);
    }

    // Must be empty
    if (node.children && node.children.size > 0)
    {
      return PromiseFast.resolve(false);
    }

    parent.children!.delete(dirName);
    return PromiseFast.resolve(true);
  }

  rename(oldPath: string, newPath: string): PromiseFast<boolean>
  {
    const oldParts = this.parsePath(oldPath);
    const oldName = oldParts.pop();
    if (!oldName)
    {
      return PromiseFast.resolve(false);
    }

    const newParts = this.parsePath(newPath);
    const newName = newParts.pop();
    if (!newName)
    {
      return PromiseFast.resolve(false);
    }

    const oldParent = oldParts.length > 0 ? this.getNode(oldParts.join('/')) : this.root;
    const newParent = newParts.length > 0 ? this.getNode(newParts.join('/')) : this.root;

    if (!oldParent || !newParent)
    {
      return PromiseFast.resolve(false);
    }

    const node = oldParent.children?.get(oldName);
    if (!node)
    {
      return PromiseFast.resolve(false);
    }

    oldParent.children!.delete(oldName);
    if (!newParent.children)
    {
      newParent.children = new Map();
    }
    newParent.children.set(newName, node);

    return PromiseFast.resolve(true);
  }
}
