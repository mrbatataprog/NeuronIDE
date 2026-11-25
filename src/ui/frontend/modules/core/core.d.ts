/* tslint:disable */
/* eslint-disable */

export class FileStorage {
    free(): void;
    [Symbol.dispose](): void;
    add_copied_element(id: number): void;
    add_cutted_element(id: number): void;
    add_element(name: string, kind: number, parent?: number | null, path?: string | null): number;
    add_selected_element(id: number): void;
    clear(): void;
    clear_copied_elements(): void;
    clear_cutted_elements(): void;
    clear_selected_elements(): void;
    close_directory(id: number): void;
    contains(id: number): boolean;
    get_all_ids(): Uint32Array;
    get_children(id: number): Uint32Array;
    get_children_count(id: number): number;
    get_content(id: number): string | undefined;
    get_cutted_elements(): Uint32Array;
    get_index(id: number): number | undefined;
    get_kind(id: number): number;
    get_loaded(id: number): boolean;
    get_name(id: number): string | undefined;
    get_open(id: number): boolean;
    get_parent(id: number): number | undefined;
    get_path(id: number): string | undefined;
    get_selected_elements(): Uint32Array;
    get_visible_count(): number;
    get_visible_element(index: number): number | undefined;
    is_cutted(id: number): boolean;
    is_empty(): boolean;
    is_selected(id: number): boolean;
    len(): number;
    constructor();
    open_directory(id: number): void;
    remove_element(id: number): void;
    set_content(id: number, value: string): void;
    set_loaded(id: number, value: boolean): void;
    set_open(id: number, value: boolean): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_filestorage_free: (a: number, b: number) => void;
    readonly filestorage_add_copied_element: (a: number, b: number) => void;
    readonly filestorage_add_cutted_element: (a: number, b: number) => void;
    readonly filestorage_add_element: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly filestorage_add_selected_element: (a: number, b: number) => void;
    readonly filestorage_clear: (a: number) => void;
    readonly filestorage_clear_copied_elements: (a: number) => void;
    readonly filestorage_clear_cutted_elements: (a: number) => void;
    readonly filestorage_clear_selected_elements: (a: number) => void;
    readonly filestorage_close_directory: (a: number, b: number) => void;
    readonly filestorage_contains: (a: number, b: number) => number;
    readonly filestorage_get_all_ids: (a: number) => [number, number];
    readonly filestorage_get_children: (a: number, b: number) => [number, number];
    readonly filestorage_get_children_count: (a: number, b: number) => number;
    readonly filestorage_get_content: (a: number, b: number) => [number, number];
    readonly filestorage_get_cutted_elements: (a: number) => [number, number];
    readonly filestorage_get_index: (a: number, b: number) => number;
    readonly filestorage_get_kind: (a: number, b: number) => number;
    readonly filestorage_get_loaded: (a: number, b: number) => number;
    readonly filestorage_get_name: (a: number, b: number) => [number, number];
    readonly filestorage_get_open: (a: number, b: number) => number;
    readonly filestorage_get_parent: (a: number, b: number) => number;
    readonly filestorage_get_path: (a: number, b: number) => [number, number];
    readonly filestorage_get_selected_elements: (a: number) => [number, number];
    readonly filestorage_get_visible_count: (a: number) => number;
    readonly filestorage_get_visible_element: (a: number, b: number) => number;
    readonly filestorage_is_cutted: (a: number, b: number) => number;
    readonly filestorage_is_empty: (a: number) => number;
    readonly filestorage_is_selected: (a: number, b: number) => number;
    readonly filestorage_len: (a: number) => number;
    readonly filestorage_new: () => number;
    readonly filestorage_open_directory: (a: number, b: number) => void;
    readonly filestorage_remove_element: (a: number, b: number) => void;
    readonly filestorage_set_content: (a: number, b: number, c: number, d: number) => void;
    readonly filestorage_set_loaded: (a: number, b: number, c: number) => void;
    readonly filestorage_set_open: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
