/**
 * Mountable VFS
 *
 * A virtual filesystem that allows mounting other VFS instances at specific paths.
 */

import { Vfs, VfsEntry, VfsStat, OpenFlags, SeekMode, FileMode } from './types';

// ============================================
// Types
// ============================================

interface MountPoint
{
  path: string;
  vfs: Vfs | null;
  entry: VfsEntry | null;
}

// ============================================
// MountableVfs
// ============================================

export class MountableVfs implements Vfs
{
  private mounts: MountPoint[] = [];

  /**
   * Mount a VFS at a path
   */
  mountVfs(path: string, vfs: Vfs): this
  {
    this.mounts.unshift({
      path: this.normalizePath(path),
      vfs,
      entry: null,
    });
    return this;
  }

  /**
   * Mount a file entry at a path
   */
  mountEntry(path: string, entry: VfsEntry): this
  {
    this.mounts.unshift({
      path: this.normalizePath(path),
      vfs: null,
      entry,
    });
    return this;
  }

  /**
   * Unmount a path
   */
  unmount(path: string): boolean
  {
    const normalizedPath = this.normalizePath(path);
    const index = this.mounts.findIndex(m => m.path === normalizedPath);
    if (index >= 0)
    {
      this.mounts.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Normalize a path
   */
  private normalizePath(path: string): string
  {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  /**
   * Transform path to mount point and remaining path
   */
  private transformPath(path: string): { mount: MountPoint; remaining: string }
  {
    path = this.normalizePath(path);

    for (const mount of this.mounts)
    {
      if (path.startsWith(mount.path))
      {
        const remaining = path.substring(mount.path.length);
        return { mount, remaining };
      }
    }

    throw new Error(`MountableVfs: Cannot find path '${path}'`);
  }

  // ---- Vfs Implementation ----

  async open(path: string, flags: OpenFlags, mode?: FileMode): Promise<VfsEntry>
  {
    const { mount, remaining } = this.transformPath(path);

    if (mount.entry)
    {
      return mount.entry;
    }

    if (mount.vfs)
    {
      return mount.vfs.open(remaining, flags, mode);
    }

    throw new Error(`MountableVfs: No VFS or entry for path '${path}'`);
  }

  async stat(path: string): Promise<VfsStat>
  {
    const { mount, remaining } = this.transformPath(path);

    if (mount.entry)
    {
      return mount.entry.stat();
    }

    if (mount.vfs)
    {
      return mount.vfs.stat(remaining);
    }

    throw new Error(`MountableVfs: No VFS or entry for path '${path}'`);
  }

  async list(path: string): Promise<VfsEntry[]>
  {
    const { mount, remaining } = this.transformPath(path);

    if (mount.vfs)
    {
      return mount.vfs.list(remaining);
    }

    return [];
  }

  async mkdir(path: string): Promise<void>
  {
    const { mount, remaining } = this.transformPath(path);

    if (mount.vfs)
    {
      return mount.vfs.mkdir(remaining);
    }

    throw new Error(`MountableVfs: Cannot create directory at '${path}'`);
  }

  async delete(path: string): Promise<void>
  {
    const { mount, remaining } = this.transformPath(path);

    if (mount.vfs)
    {
      return mount.vfs.delete(remaining);
    }

    throw new Error(`MountableVfs: Cannot delete '${path}'`);
  }

  async rename(oldPath: string, newPath: string): Promise<void>
  {
    const oldInfo = this.transformPath(oldPath);
    const newInfo = this.transformPath(newPath);

    if (oldInfo.mount !== newInfo.mount)
    {
      throw new Error('MountableVfs: Cannot rename across mount points');
    }

    if (oldInfo.mount.vfs)
    {
      return oldInfo.mount.vfs.rename(oldInfo.remaining, newInfo.remaining);
    }

    throw new Error(`MountableVfs: Cannot rename '${oldPath}'`);
  }

  /**
   * Get all mount points
   */
  getMounts(): { path: string; hasVfs: boolean; hasEntry: boolean }[]
  {
    return this.mounts.map(m => ({
      path: m.path,
      hasVfs: m.vfs !== null,
      hasEntry: m.entry !== null,
    }));
  }
}
