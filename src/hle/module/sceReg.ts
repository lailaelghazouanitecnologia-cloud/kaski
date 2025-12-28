import {Stream} from "../../global/stream";
import {
    Struct,
    StructInt32,
    StructStructStringz,
    StructUInt32
} from "../../global/struct";
import {EmulatorContext} from "../../emu/context";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";
import {SceKernelErrors} from "../SceKernelErrors";

/**
 * PSP Registry Module - Based on PPSSPP implementation
 * https://github.com/hrydgard/ppsspp/blob/master/Core/HLE/sceReg.cpp
 */

// Registry value types (matching PPSSPP)
enum RegKeyTypes {
    REG_TYPE_DIR = 1,
    REG_TYPE_INT = 2,
    REG_TYPE_STR = 3,
    REG_TYPE_BIN = 4
}

enum ValueType {
    FAIL = 0,
    DIR = 1,
    INT = 2,
    STR = 3,
    BIN = 4
}

interface KeyValue {
    name: string;
    type: ValueType;
    intValue?: number;
    strValue?: string;
    binValue?: Uint8Array;
    children?: KeyValue[];
}

// Hardcoded registry data (based on PPSSPP)
const FONT_PROPERTY: KeyValue[] = [
    { name: "jpn0.pgf", type: ValueType.DIR, children: [
        { name: "path", type: ValueType.STR, strValue: "/font/jpn0.pgf" },
        { name: "family_code", type: ValueType.INT, intValue: 1 },
        { name: "h_size", type: ValueType.INT, intValue: 20 },
        { name: "v_size", type: ValueType.INT, intValue: 20 },
        { name: "h_resolution", type: ValueType.INT, intValue: 128 },
        { name: "v_resolution", type: ValueType.INT, intValue: 128 },
    ]},
    { name: "ltn0.pgf", type: ValueType.DIR, children: [
        { name: "path", type: ValueType.STR, strValue: "/font/ltn0.pgf" },
        { name: "family_code", type: ValueType.INT, intValue: 1 },
        { name: "h_size", type: ValueType.INT, intValue: 20 },
        { name: "v_size", type: ValueType.INT, intValue: 20 },
        { name: "h_resolution", type: ValueType.INT, intValue: 128 },
        { name: "v_resolution", type: ValueType.INT, intValue: 128 },
    ]},
    { name: "ltn1.pgf", type: ValueType.DIR, children: [
        { name: "path", type: ValueType.STR, strValue: "/font/ltn1.pgf" },
        { name: "family_code", type: ValueType.INT, intValue: 2 },
        { name: "h_size", type: ValueType.INT, intValue: 20 },
        { name: "v_size", type: ValueType.INT, intValue: 20 },
        { name: "h_resolution", type: ValueType.INT, intValue: 128 },
        { name: "v_resolution", type: ValueType.INT, intValue: 128 },
    ]},
];

const ROOT: KeyValue[] = [
    {
        name: "system",
        type: ValueType.DIR,
        children: [
            { name: "np_env", type: ValueType.STR, strValue: "np" },
            { name: "adhoc_ssid_prefix", type: ValueType.STR, strValue: "PSP" },
            { name: "nickname", type: ValueType.STR, strValue: "JSPSPEMU" },
            { name: "language", type: ValueType.INT, intValue: 1 }, // English
            { name: "button_assign", type: ValueType.INT, intValue: 0 },
        ]
    },
    {
        name: "DATA",
        type: ValueType.DIR,
        children: [
            {
                name: "FONT",
                type: ValueType.DIR,
                children: [
                    {
                        name: "PROPERTY",
                        type: ValueType.DIR,
                        children: FONT_PROPERTY
                    },
                    { name: "path_name", type: ValueType.STR, strValue: "flash0:/font" }
                ]
            },
            {
                name: "COUNT",
                type: ValueType.DIR,
                children: [
                    { name: "icon_count", type: ValueType.INT, intValue: 0 },
                    { name: "icon_max_title_length", type: ValueType.INT, intValue: 80 },
                    { name: "game_boot_count", type: ValueType.INT, intValue: 0 },
                    { name: "game_exec_count", type: ValueType.INT, intValue: 0 },
                ]
            }
        ]
    },
    {
        name: "config",
        type: ValueType.DIR,
        children: [
            { name: "camera", type: ValueType.INT, intValue: 0 },
            { name: "net", type: ValueType.INT, intValue: 0 },
        ]
    }
];

// Category management
interface OpenCategory {
    handle: number;
    path: string;
    mode: number;
    keys: KeyValue[];
}

export class sceReg {
    constructor(private context: EmulatorContext) { }

    private handleGen = 1;
    private openCategories = new Map<number, OpenCategory>();
    private registryOpen = false;

    /** Lookup a category by path */
    private lookupCategory(path: string): KeyValue[] | null {
        const parts = path.split('/').filter(p => p.length > 0);
        let current = ROOT;

        for (const part of parts) {
            const found = current.find(k => k.name === part && k.type === ValueType.DIR);
            if (!found || !found.children) {
                return null;
            }
            current = found.children;
        }

        return current;
    }

    /** Find a key by name in a category */
    private findKey(keys: KeyValue[], name: string): KeyValue | null {
        return keys.find(k => k.name === name) || null;
    }

    @nativeFunction(0x92E41280, 150)
    @I32 sceRegOpenRegistry(@PTR regParamPtr: Stream, @I32 mode: number, @PTR regHandlePtr: Stream) {
        const regParam = RegParam.struct.read(regParamPtr);
        console.info(`sceRegOpenRegistry: ${regParam.name}, mode=${mode}`);

        this.registryOpen = true;
        regHandlePtr.writeInt32(1); // Registry handle
        return 0;
    }

    @nativeFunction(0x1D8A762E, 150)
    @I32 sceRegOpenCategory(@I32 regHandle: number, @STRING name: string, @I32 mode: number, @PTR regCategoryHandlePtr: Stream) {
        console.info(`sceRegOpenCategory: ${name}, mode=${mode}`);

        if (!this.registryOpen) {
            return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
        }

        const keys = this.lookupCategory(name);
        if (!keys) {
            console.warn(`sceRegOpenCategory: Category not found: ${name}`);
            return SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND;
        }

        const handle = this.handleGen++;
        this.openCategories.set(handle, {
            handle,
            path: name,
            mode,
            keys
        });

        regCategoryHandlePtr.writeInt32(handle);
        return 0;
    }

    @nativeFunction(0xD4475AA8, 150)
    @I32 sceRegGetKeyInfo(
        @I32 categoryHandle: number,
        @STRING name: string,
        @PTR regKeyHandlePtr: Stream,
        @PTR regKeyTypesPtr: Stream,
        @PTR sizePtr: Stream
    ) {
        const category = this.openCategories.get(categoryHandle);
        if (!category) {
            return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
        }

        const key = this.findKey(category.keys, name);
        if (!key) {
            console.warn(`sceRegGetKeyInfo: Key not found: ${name}`);
            return SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND;
        }

        // Generate key handle
        const keyHandle = this.handleGen++;
        regKeyHandlePtr.writeInt32(keyHandle);

        // Write key type
        let regType = RegKeyTypes.REG_TYPE_INT;
        let size = 4;

        switch (key.type) {
            case ValueType.DIR:
                regType = RegKeyTypes.REG_TYPE_DIR;
                size = 0;
                break;
            case ValueType.INT:
                regType = RegKeyTypes.REG_TYPE_INT;
                size = 4;
                break;
            case ValueType.STR:
                regType = RegKeyTypes.REG_TYPE_STR;
                size = key.strValue ? key.strValue.length + 1 : 1;
                break;
            case ValueType.BIN:
                regType = RegKeyTypes.REG_TYPE_BIN;
                size = key.binValue ? key.binValue.length : 0;
                break;
        }

        regKeyTypesPtr.writeInt32(regType);
        sizePtr.writeInt32(size);

        return 0;
    }

    @nativeFunction(0x28A8E98A, 150)
    @I32 sceRegGetKeyValue(
        @I32 categoryHandle: number,
        @I32 regKeyHandle: number,
        @PTR bufferPtr: Stream,
        @I32 size: number
    ) {
        const category = this.openCategories.get(categoryHandle);
        if (!category) {
            return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
        }

        // Find key by iterating (we don't track key handles separately)
        // In a real implementation we'd map keyHandle to key
        // For now, just get the first matching key by looking at all
        for (const key of category.keys) {
            if (key.type === ValueType.INT && key.intValue !== undefined) {
                bufferPtr.writeInt32(key.intValue);
                return 0;
            } else if (key.type === ValueType.STR && key.strValue !== undefined) {
                bufferPtr.writeStringz(key.strValue);
                return 0;
            } else if (key.type === ValueType.BIN && key.binValue !== undefined) {
                bufferPtr.writeBytes(key.binValue.slice(0, size));
                return 0;
            }
        }

        return 0;
    }

    @nativeFunction(0xD0A3EB9E, 150)
    @I32 sceRegGetKeysNum(@I32 categoryHandle: number, @PTR numPtr: Stream) {
        const category = this.openCategories.get(categoryHandle);
        if (!category) {
            return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
        }

        numPtr.writeInt32(category.keys.length);
        return 0;
    }

    @nativeFunction(0x4E63AB9F, 150)
    @I32 sceRegGetKeys(@I32 categoryHandle: number, @PTR keysPtr: Stream, @I32 numKeys: number) {
        const category = this.openCategories.get(categoryHandle);
        if (!category) {
            return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
        }

        // Write key names (27 chars each as per PPSSPP)
        const maxNameLen = 27;
        for (let i = 0; i < Math.min(numKeys, category.keys.length); i++) {
            const name = category.keys[i].name.substring(0, maxNameLen - 1);
            // Pad with null characters (ES6 compatible)
            let paddedName = name;
            while (paddedName.length < maxNameLen) {
                paddedName += '\0';
            }
            keysPtr.writeString(paddedName);
        }

        return 0;
    }

    @nativeFunction(0x0D69BF40, 150)
    @I32 sceRegFlushCategory(@I32 categoryHandle: number) {
        // Read-only registry, flush is no-op
        return 0;
    }

    @nativeFunction(0x0CAE832B, 150)
    @I32 sceRegCloseCategory(@I32 categoryHandle: number) {
        if (this.openCategories.has(categoryHandle)) {
            this.openCategories.delete(categoryHandle);
            return 0;
        }
        return SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND;
    }

    @nativeFunction(0x39461B4D, 150)
    @I32 sceRegFlushRegistry(@I32 regHandle: number) {
        // Read-only registry, flush is no-op
        return 0;
    }

    @nativeFunction(0xFA8A5739, 150)
    @I32 sceRegCloseRegistry(@I32 regHandle: number) {
        this.openCategories.clear();
        this.registryOpen = false;
        return 0;
    }
}

class RegParam extends Struct {
    @StructUInt32 regType: number = 0
    @StructStructStringz(256) name: string = ''
    @StructInt32 nameLength: number = 0
    @StructInt32 unknown2: number = 0
    @StructInt32 unknown3: number = 0
}
