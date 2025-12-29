/**
 * ELF - Executable and Linkable Format
 *
 * Parser for PSP ELF and PRX (relocatable) files.
 * The PSP uses MIPS ELF with some extensions.
 */

import { Stream } from './stream';

// ============================================
// Constants
// ============================================

/** ELF magic bytes */
export const ELF_MAGIC = [0x7F, 0x45, 0x4C, 0x46]; // \x7FELF

/** ELF class */
export const enum ElfClass
{
  NONE = 0,
  ELF32 = 1,
  ELF64 = 2,
}

/** ELF data encoding */
export const enum ElfData
{
  NONE = 0,
  LSB = 1,  // Little endian
  MSB = 2,  // Big endian
}

/** ELF type */
export const enum ElfType
{
  NONE = 0,
  REL = 1,      // Relocatable
  EXEC = 2,     // Executable
  DYN = 3,      // Shared object
  CORE = 4,     // Core dump
  PRX = 0xFFA0, // PSP PRX
}

/** ELF machine type */
export const enum ElfMachine
{
  NONE = 0,
  MIPS = 8,           // MIPS
  MIPS_RS3_LE = 10,   // MIPS RS3000 LE
  ALLEGREX = 8,       // PSP uses MIPS
}

/** Program header type */
export const enum ProgramType
{
  NULL = 0,
  LOAD = 1,
  DYNAMIC = 2,
  INTERP = 3,
  NOTE = 4,
  SHLIB = 5,
  PHDR = 6,
  TLS = 7,
  PRX_RELOC = 0x700000A0, // PSP relocation
}

/** Program header flags */
export const enum ProgramFlags
{
  EXEC = 1,
  WRITE = 2,
  READ = 4,
}

/** Section header type */
export const enum SectionType
{
  NULL = 0,
  PROGBITS = 1,
  SYMTAB = 2,
  STRTAB = 3,
  RELA = 4,
  HASH = 5,
  DYNAMIC = 6,
  NOTE = 7,
  NOBITS = 8,
  REL = 9,
  SHLIB = 10,
  DYNSYM = 11,
  PRX_RELOC = 0x700000A0,
}

/** MIPS relocation types */
export const enum RelocationType
{
  NONE = 0,
  R_MIPS_16 = 1,
  R_MIPS_32 = 2,
  R_MIPS_REL32 = 3,
  R_MIPS_26 = 4,
  R_MIPS_HI16 = 5,
  R_MIPS_LO16 = 6,
  R_MIPS_GPREL16 = 7,
  R_MIPS_LITERAL = 8,
  R_MIPS_GOT16 = 9,
  R_MIPS_PC16 = 10,
  R_MIPS_CALL16 = 11,
  R_MIPS_GPREL32 = 12,
}

// ============================================
// Structures
// ============================================

/**
 * ELF Header (32-bit)
 */
export interface ElfHeader
{
  /** Magic bytes (should be ELF_MAGIC) */
  magic: Uint8Array;
  /** File class (32/64 bit) */
  class: ElfClass;
  /** Data encoding (endianness) */
  data: ElfData;
  /** ELF version */
  version: number;
  /** OS/ABI identification */
  osabi: number;
  /** ABI version */
  abiVersion: number;
  /** Object file type */
  type: ElfType;
  /** Target machine */
  machine: ElfMachine;
  /** Object file version */
  elfVersion: number;
  /** Entry point address */
  entry: number;
  /** Program header table offset */
  phOffset: number;
  /** Section header table offset */
  shOffset: number;
  /** Processor-specific flags */
  flags: number;
  /** ELF header size */
  ehSize: number;
  /** Program header entry size */
  phEntSize: number;
  /** Number of program headers */
  phNum: number;
  /** Section header entry size */
  shEntSize: number;
  /** Number of section headers */
  shNum: number;
  /** Section name string table index */
  shStrNdx: number;
}

/**
 * Program Header (32-bit)
 */
export interface ProgramHeader
{
  /** Segment type */
  type: ProgramType;
  /** Segment file offset */
  offset: number;
  /** Virtual address */
  vaddr: number;
  /** Physical address */
  paddr: number;
  /** Segment size in file */
  filesz: number;
  /** Segment size in memory */
  memsz: number;
  /** Segment flags */
  flags: ProgramFlags;
  /** Segment alignment */
  align: number;
}

/**
 * Section Header (32-bit)
 */
export interface SectionHeader
{
  /** Section name (index into string table) */
  nameIndex: number;
  /** Section name (resolved) */
  name: string;
  /** Section type */
  type: SectionType;
  /** Section flags */
  flags: number;
  /** Virtual address */
  addr: number;
  /** Section file offset */
  offset: number;
  /** Section size */
  size: number;
  /** Link to another section */
  link: number;
  /** Additional section info */
  info: number;
  /** Section alignment */
  addralign: number;
  /** Entry size (for tables) */
  entsize: number;
}

/**
 * ELF Symbol
 */
export interface ElfSymbol
{
  /** Symbol name (index into string table) */
  nameIndex: number;
  /** Symbol name (resolved) */
  name: string;
  /** Symbol value/address */
  value: number;
  /** Symbol size */
  size: number;
  /** Symbol info (type and binding) */
  info: number;
  /** Symbol type */
  type: number;
  /** Symbol binding */
  binding: number;
  /** Symbol visibility */
  other: number;
  /** Section index */
  shndx: number;
}

/**
 * Relocation entry
 */
export interface RelocationEntry
{
  /** Relocation offset */
  offset: number;
  /** Relocation info (type and symbol) */
  info: number;
  /** Relocation type */
  type: RelocationType;
  /** Symbol index */
  symbolIndex: number;
  /** Addend (for RELA) */
  addend?: number;
}

/**
 * PSP Module Info
 */
export interface PspModuleInfo
{
  /** Module attributes */
  attributes: number;
  /** Module version */
  version: number[];
  /** Module name */
  name: string;
  /** GP value */
  gp: number;
  /** Export table */
  exportsStart: number;
  exportsEnd: number;
  /** Import table */
  importsStart: number;
  importsEnd: number;
}

/**
 * PSP Import Entry
 */
export interface PspImportEntry
{
  /** Module name */
  moduleName: string;
  /** Module name address */
  nameAddr: number;
  /** Version */
  version: number;
  /** Attributes */
  attr: number;
  /** Number of functions */
  funcCount: number;
  /** Number of variables */
  varCount: number;
  /** NID table address */
  nidData: number;
  /** Stub table address */
  funcData: number;
  /** Variable import address */
  varData: number;
  /** NIDs to import */
  nids: number[];
  /** Stub addresses */
  stubAddrs: number[];
}

// ============================================
// ELF Loader
// ============================================

/**
 * ELF File
 */
export class ElfFile
{
  readonly header: ElfHeader;
  readonly programHeaders: ProgramHeader[];
  readonly sectionHeaders: SectionHeader[];
  readonly symbols: ElfSymbol[];
  readonly relocations: RelocationEntry[];
  readonly moduleInfo?: PspModuleInfo;
  readonly imports: PspImportEntry[] = [];

  private stream: Stream;
  private sectionsByName: Map<string, SectionHeader>;

  constructor(stream: Stream)
  {
    this.stream = stream;
    this.sectionsByName = new Map();

    // Parse header
    this.header = this.parseHeader();
    this.validateHeader();

    // Parse program and section headers
    this.programHeaders = this.parseProgramHeaders();
    this.sectionHeaders = this.parseSectionHeaders();

    // Resolve section names
    this.resolveSectionNames();

    // Build section index
    for (const section of this.sectionHeaders)
    {
      if (section.name)
      {
        this.sectionsByName.set(section.name, section);
      }
    }

    // Parse symbols
    this.symbols = this.parseSymbols();

    // Parse relocations
    this.relocations = this.parseRelocations();

    // Parse module info for PRX
    if (this.isPrx)
    {
      this.moduleInfo = this.parseModuleInfo();
    }

    // Note: imports are parsed after loading into memory
    // because we need to read NID/stub addresses from loaded memory
  }

  /**
   * Load ELF from buffer
   */
  static fromBuffer(buffer: ArrayBuffer): ElfFile
  {
    return new ElfFile(new Stream(buffer));
  }

  /**
   * Load ELF from Uint8Array
   */
  static fromUint8Array(data: Uint8Array): ElfFile
  {
    return new ElfFile(Stream.fromUint8Array(data));
  }

  // ============================================
  // Properties
  // ============================================

  /** Is this a PRX (relocatable) file? */
  get isPrx(): boolean
  {
    return this.header.type === ElfType.PRX;
  }

  /** Does this file need relocation? */
  get needsRelocation(): boolean
  {
    return this.isPrx || this.relocations.length > 0;
  }

  /** Entry point address */
  get entryPoint(): number
  {
    return this.header.entry;
  }

  /** Get section by name */
  getSection(name: string): SectionHeader | undefined
  {
    return this.sectionsByName.get(name);
  }

  /** Get section data */
  getSectionData(section: SectionHeader): Stream
  {
    return this.stream.sliceAt(section.offset, section.size);
  }

  /** Get section data by name */
  getSectionDataByName(name: string): Stream | undefined
  {
    const section = this.getSection(name);
    if (!section) return undefined;
    return this.getSectionData(section);
  }

  /** Get loadable segments */
  getLoadableSegments(): ProgramHeader[]
  {
    return this.programHeaders.filter(ph => ph.type === ProgramType.LOAD);
  }

  /** Get segment data */
  getSegmentData(segment: ProgramHeader): Stream
  {
    return this.stream.sliceAt(segment.offset, segment.filesz);
  }

  // ============================================
  // Parsing
  // ============================================

  private parseHeader(): ElfHeader
  {
    const s = this.stream;
    s.seek(0);

    // Check magic first before reading the entire header
    const magic = s.readBytes(4);
    if (magic[0] !== 0x7F || magic[1] !== 0x45 ||
        magic[2] !== 0x4C || magic[3] !== 0x46)
    {
      throw new Error('Invalid ELF magic');
    }

    return {
      magic,
      class: s.readUint8() as ElfClass,
      data: s.readUint8() as ElfData,
      version: s.readUint8(),
      osabi: s.readUint8(),
      abiVersion: s.readUint8(),
      // 7 bytes padding
      ...(s.skip(7), {}),
      type: s.readUint16() as ElfType,
      machine: s.readUint16() as ElfMachine,
      elfVersion: s.readUint32(),
      entry: s.readUint32(),
      phOffset: s.readUint32(),
      shOffset: s.readUint32(),
      flags: s.readUint32(),
      ehSize: s.readUint16(),
      phEntSize: s.readUint16(),
      phNum: s.readUint16(),
      shEntSize: s.readUint16(),
      shNum: s.readUint16(),
      shStrNdx: s.readUint16(),
    };
  }

  private validateHeader(): void
  {
    const h = this.header;

    // Magic is already validated in parseHeader

    // Check class (must be 32-bit for PSP)
    if (h.class !== ElfClass.ELF32)
    {
      throw new Error(`Unsupported ELF class: ${h.class}`);
    }

    // Check endianness (PSP is little-endian)
    if (h.data !== ElfData.LSB)
    {
      throw new Error(`Unsupported ELF data encoding: ${h.data}`);
    }

    // Check machine (must be MIPS for PSP)
    if (h.machine !== ElfMachine.MIPS && h.machine !== ElfMachine.ALLEGREX)
    {
      throw new Error(`Unsupported machine type: ${h.machine}`);
    }
  }

  private parseProgramHeaders(): ProgramHeader[]
  {
    const headers: ProgramHeader[] = [];
    const { phOffset, phNum, phEntSize } = this.header;

    for (let i = 0; i < phNum; i++)
    {
      this.stream.seek(phOffset + i * phEntSize);
      headers.push({
        type: this.stream.readUint32() as ProgramType,
        offset: this.stream.readUint32(),
        vaddr: this.stream.readUint32(),
        paddr: this.stream.readUint32(),
        filesz: this.stream.readUint32(),
        memsz: this.stream.readUint32(),
        flags: this.stream.readUint32() as ProgramFlags,
        align: this.stream.readUint32(),
      });
    }

    return headers;
  }

  private parseSectionHeaders(): SectionHeader[]
  {
    const headers: SectionHeader[] = [];
    const { shOffset, shNum, shEntSize } = this.header;

    for (let i = 0; i < shNum; i++)
    {
      this.stream.seek(shOffset + i * shEntSize);
      headers.push({
        nameIndex: this.stream.readUint32(),
        name: '', // Resolved later
        type: this.stream.readUint32() as SectionType,
        flags: this.stream.readUint32(),
        addr: this.stream.readUint32(),
        offset: this.stream.readUint32(),
        size: this.stream.readUint32(),
        link: this.stream.readUint32(),
        info: this.stream.readUint32(),
        addralign: this.stream.readUint32(),
        entsize: this.stream.readUint32(),
      });
    }

    return headers;
  }

  private resolveSectionNames(): void
  {
    const { shStrNdx } = this.header;
    if (shStrNdx === 0 || shStrNdx >= this.sectionHeaders.length)
    {
      return;
    }

    const strTab = this.sectionHeaders[shStrNdx];
    const strData = this.stream.sliceAt(strTab.offset, strTab.size);

    for (const section of this.sectionHeaders)
    {
      section.name = strData.readStringAt(section.nameIndex);
    }
  }

  private parseSymbols(): ElfSymbol[]
  {
    const symbols: ElfSymbol[] = [];

    const symtab = this.getSection('.symtab');
    const strtab = this.getSection('.strtab');

    if (!symtab || !strtab) return symbols;

    const symData = this.getSectionData(symtab);
    const strData = this.getSectionData(strtab);

    const count = symtab.size / 16; // Symbol entry is 16 bytes

    for (let i = 0; i < count; i++)
    {
      const nameIndex = symData.readUint32();
      const value = symData.readUint32();
      const size = symData.readUint32();
      const info = symData.readUint8();
      const other = symData.readUint8();
      const shndx = symData.readUint16();

      symbols.push({
        nameIndex,
        name: strData.readStringAt(nameIndex),
        value,
        size,
        info,
        type: info & 0xF,
        binding: info >> 4,
        other,
        shndx,
      });
    }

    return symbols;
  }

  private parseRelocations(): RelocationEntry[]
  {
    const relocations: RelocationEntry[] = [];

    for (const section of this.sectionHeaders)
    {
      if (section.type !== SectionType.REL &&
          section.type !== SectionType.RELA &&
          section.type !== SectionType.PRX_RELOC)
      {
        continue;
      }

      const data = this.getSectionData(section);
      const isRela = section.type === SectionType.RELA;
      const entrySize = isRela ? 12 : 8;
      const count = section.size / entrySize;

      for (let i = 0; i < count; i++)
      {
        const offset = data.readUint32();
        const info = data.readUint32();
        const addend = isRela ? data.readInt32() : undefined;

        relocations.push({
          offset,
          info,
          type: (info & 0xFF) as RelocationType,
          symbolIndex: info >> 8,
          addend,
        });
      }
    }

    return relocations;
  }

  private parseModuleInfo(): PspModuleInfo | undefined
  {
    // Module info is in .rodata.sceModuleInfo section
    const section = this.getSection('.rodata.sceModuleInfo');
    if (!section) return undefined;

    const data = this.getSectionData(section);

    return {
      attributes: data.readUint16(),
      version: [data.readUint8(), data.readUint8()],
      name: data.readString(28).replace(/\0+$/, ''),
      gp: data.readUint32(),
      exportsStart: data.readUint32(),
      exportsEnd: data.readUint32(),
      importsStart: data.readUint32(),
      importsEnd: data.readUint32(),
    };
  }

  // ============================================
  // Loading
  // ============================================

  /**
   * Load ELF into memory
   */
  loadIntoMemory(
    memory: { sw: (addr: number, value: number) => void },
    baseAddress: number = 0
  ): { entryPoint: number; size: number }
  {
    let maxAddr = 0;

    for (const segment of this.getLoadableSegments())
    {
      const data = this.getSegmentData(segment);
      const vaddr = segment.vaddr + baseAddress;

      // Copy segment data
      for (let i = 0; i < segment.filesz; i += 4)
      {
        const word = i + 3 < segment.filesz
          ? data.readUint32()
          : (data.readBytes(Math.min(4, segment.filesz - i))[0] || 0);
        memory.sw(vaddr + i, word);
      }

      // Zero BSS (memsz > filesz)
      for (let i = segment.filesz; i < segment.memsz; i += 4)
      {
        memory.sw(vaddr + i, 0);
      }

      maxAddr = Math.max(maxAddr, vaddr + segment.memsz);
    }

    return {
      entryPoint: this.header.entry + baseAddress,
      size: maxAddr - baseAddress,
    };
  }

  /**
   * Apply relocations
   */
  applyRelocations(
    memory: {
      lw: (addr: number) => number;
      sw: (addr: number, value: number) => void;
    },
    baseAddress: number
  ): void
  {
    for (const rel of this.relocations)
    {
      const addr = rel.offset + baseAddress;
      const value = memory.lw(addr);

      switch (rel.type)
      {
        case RelocationType.R_MIPS_32:
          memory.sw(addr, value + baseAddress);
          break;

        case RelocationType.R_MIPS_26:
          {
            const target = ((value & 0x03FFFFFF) << 2) + baseAddress;
            memory.sw(addr, (value & 0xFC000000) | ((target >> 2) & 0x03FFFFFF));
          }
          break;

        case RelocationType.R_MIPS_HI16:
          {
            const hi = ((value & 0xFFFF) << 16) + baseAddress;
            memory.sw(addr, (value & 0xFFFF0000) | ((hi >> 16) & 0xFFFF));
          }
          break;

        case RelocationType.R_MIPS_LO16:
          {
            const lo = (value & 0xFFFF) + (baseAddress & 0xFFFF);
            memory.sw(addr, (value & 0xFFFF0000) | (lo & 0xFFFF));
          }
          break;

        // Add more relocation types as needed
      }
    }
  }

  /**
   * Parse import table from loaded memory
   *
   * Must be called after loadIntoMemory() and applyRelocations()
   */
  parseImports(
    memory: {
      lw: (addr: number) => number;
      lbu: (addr: number) => number;
      readString: (addr: number, maxLen?: number) => string;
    },
    baseAddress: number = 0
  ): PspImportEntry[]
  {
    if (!this.moduleInfo)
    {
      return [];
    }

    const imports: PspImportEntry[] = [];
    const importsStart = this.moduleInfo.importsStart + baseAddress;
    const importsEnd = this.moduleInfo.importsEnd + baseAddress;

    // Each import entry is 20 bytes (old format):
    // offset 0:  nameOffset (4 bytes)
    // offset 4:  version (2 bytes)
    // offset 6:  flags/attr (2 bytes)
    // offset 8:  entrySize (1 byte)
    // offset 9:  variableCount (1 byte)
    // offset 10: functionCount (2 bytes)
    // offset 12: nidAddress (4 bytes)
    // offset 16: callAddress (4 bytes)
    const IMPORT_ENTRY_SIZE = 20;

    let offset = importsStart;
    while (offset + IMPORT_ENTRY_SIZE <= importsEnd)
    {
      const nameAddr = memory.lw(offset) >>> 0;
      const version = memory.lhu(offset + 4);
      const attr = memory.lhu(offset + 6);
      const entrySize = memory.lbu(offset + 8);
      const varCount = memory.lbu(offset + 9);
      const funcCount = memory.lhu(offset + 10);
      const nidData = memory.lw(offset + 12) >>> 0;
      const funcData = memory.lw(offset + 16) >>> 0;

      // Read module name
      const moduleName = nameAddr ? memory.readString(nameAddr, 64) : '';

      // Read NIDs and stub addresses
      const nids: number[] = [];
      const stubAddrs: number[] = [];

      for (let i = 0; i < funcCount; i++)
      {
        nids.push(memory.lw(nidData + i * 4) >>> 0);
        stubAddrs.push(funcData + i * 8); // Each stub is 8 bytes (2 instructions)
      }

      imports.push({
        moduleName,
        nameAddr,
        version,
        attr,
        funcCount,
        varCount,
        nidData,
        funcData,
        varData: 0, // Not used in old format
        nids,
        stubAddrs,
      });

      offset += IMPORT_ENTRY_SIZE;
    }

    // Store imports
    (this.imports as PspImportEntry[]).push(...imports);

    return imports;
  }

  /**
   * Patch import stubs with syscall instructions
   *
   * @param memory Memory interface
   * @param nidToSyscall Function that maps NID to syscall number
   * @returns Number of patched stubs
   */
  patchImportStubs(
    memory: {
      lw: (addr: number) => number;
      sw: (addr: number, value: number) => void;
    },
    nidToSyscall: (nid: number, moduleName: string) => number | undefined
  ): number
  {
    let patchCount = 0;

    for (const imp of this.imports)
    {
      for (let i = 0; i < imp.nids.length; i++)
      {
        const nid = imp.nids[i];
        const stubAddr = imp.stubAddrs[i];
        const syscallNum = nidToSyscall(nid, imp.moduleName);

        if (syscallNum !== undefined)
        {
          // PSP import stub format:
          // Instruction 0: jr $ra (0x03E00008)
          // Instruction 1: syscall <num> (0x0000000C | (num << 6))

          // Write jr $ra
          memory.sw(stubAddr, 0x03E00008);
          // Write syscall with the NID as the code
          // The syscall code is in bits 25-6 (20 bits)
          memory.sw(stubAddr + 4, 0x0000000C | (syscallNum << 6));
          patchCount++;
        }
      }
    }

    return patchCount;
  }
}
