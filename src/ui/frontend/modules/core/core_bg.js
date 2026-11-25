export class FileStorage {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FileStorageFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_filestorage_free(ptr, 0);
    }
    /**
     * @param {number} id
     */
    add_copied_element(id) {
        wasm.filestorage_add_copied_element(this.__wbg_ptr, id);
    }
    /**
     * @param {number} id
     */
    add_cutted_element(id) {
        wasm.filestorage_add_cutted_element(this.__wbg_ptr, id);
    }
    /**
     * @param {string} name
     * @param {number} kind
     * @param {number | null} [parent]
     * @returns {number}
     */
    add_element(name, kind, parent) {
        const val2 = +kind;
        const val3 = +(isLikeNone(parent) ? Number.MAX_SAFE_INTEGER : (parent) >>> 0);
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.filestorage_add_element(this.__wbg_ptr, ptr0, len0, val2, val3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * @param {number} id
     */
    add_selected_element(id) {
        wasm.filestorage_add_selected_element(this.__wbg_ptr, id);
    }
    clear_copied_elements() {
        wasm.filestorage_clear_copied_elements(this.__wbg_ptr);
    }
    clear_cutted_elements() {
        wasm.filestorage_clear_cutted_elements(this.__wbg_ptr);
    }
    clear_selected_elements() {
        wasm.filestorage_clear_selected_elements(this.__wbg_ptr);
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    contains(id) {
        const ret = wasm.filestorage_contains(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @returns {Uint32Array}
     */
    get_all_ids() {
        const ret = wasm.filestorage_get_all_ids(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} id
     * @returns {Uint32Array}
     */
    get_children(id) {
        const ret = wasm.filestorage_get_children(this.__wbg_ptr, id);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} id
     * @returns {string | undefined}
     */
    get_content(id) {
        const ret = wasm.filestorage_get_content(this.__wbg_ptr, id);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @returns {Uint32Array}
     */
    get_cutted_elements() {
        const ret = wasm.filestorage_get_cutted_elements(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} id
     * @returns {number | undefined}
     */
    get_index(id) {
        const ret = wasm.filestorage_get_index(this.__wbg_ptr, id);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @param {number} id
     * @returns {number}
     */
    get_kind(id) {
        const ret = wasm.filestorage_get_kind(this.__wbg_ptr, id);
        return ret;
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    get_loaded(id) {
        const ret = wasm.filestorage_get_loaded(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @returns {string | undefined}
     */
    get_name(id) {
        const ret = wasm.filestorage_get_name(this.__wbg_ptr, id);
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    get_open(id) {
        const ret = wasm.filestorage_get_open(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @returns {number | undefined}
     */
    get_parent(id) {
        const ret = wasm.filestorage_get_parent(this.__wbg_ptr, id);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @returns {Uint32Array}
     */
    get_selected_elements() {
        const ret = wasm.filestorage_get_selected_elements(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    is_cutted(id) {
        const ret = wasm.filestorage_is_cutted(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    is_empty() {
        const ret = wasm.filestorage_is_empty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} id
     * @returns {boolean}
     */
    is_selected(id) {
        const ret = wasm.filestorage_is_selected(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.filestorage_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.filestorage_new();
        this.__wbg_ptr = ret;
        FileStorageFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} id
     */
    remove_element(id) {
        wasm.filestorage_remove_element(this.__wbg_ptr, id);
    }
    /**
     * @param {number} id
     * @param {string} value
     */
    set_content(id, value) {
        const val2 = +id;
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.filestorage_set_content(this.__wbg_ptr, val2, ptr0, len0);
    }
    /**
     * @param {number} id
     * @param {boolean} value
     */
    set_loaded(id, value) {
        wasm.filestorage_set_loaded(this.__wbg_ptr, id, value);
    }
    /**
     * @param {number} id
     * @param {boolean} value
     */
    set_open(id, value) {
        wasm.filestorage_set_open(this.__wbg_ptr, id, value);
    }
}
if (Symbol.dispose) FileStorage.prototype[Symbol.dispose] = FileStorage.prototype.free;
export function __wbg___wbindgen_throw_4c88d8bf264fd984(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbindgen_generic_0000000000000001(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_externrefs;
    table.set(0, undefined);
    table.set(1024, undefined);
    table.set(1025, null);
    table.set(1026, true);
    table.set(1027, false);
}
const FileStorageFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_filestorage_free(ptr, 1));

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
