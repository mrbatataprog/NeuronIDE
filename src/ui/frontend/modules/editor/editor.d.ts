/* tslint:disable */
/* eslint-disable */

export class Editor {
    free(): void;
    [Symbol.dispose](): void;
    byte_count(): number;
    char_count(): number;
    char_to_byte(char_index: number): number;
    char_to_line(char_index: number): number;
    char_to_utf16(char_index: number): number;
    clear(): void;
    create_buffer(id: number): void;
    delete(start: number, end: number): void;
    get_buffer_text(id: number): string;
    get_char(char_index: number): string | undefined;
    get_line(line_index: number): string | undefined;
    get_line_content(line_index: number): string | undefined;
    get_lines(start: number, end: number): string;
    get_range(start: number, end: number): string;
    get_text(): string;
    get_text_from_byte(byte_index: number): string;
    has_buffer(id: number): boolean;
    insert(char_index: number, text: string): void;
    line_count(): number;
    line_to_char(line_index: number): number;
    constructor();
    remove_buffer(id: number): void;
    replace(start: number, end: number, replacement: string): void;
    set_text(text: string): void;
    switch_buffer(id: number): void;
    utf16_length(): number;
    utf16_to_char(utf16_index: number): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_editor_free: (a: number, b: number) => void;
    readonly editor_byte_count: (a: number) => [number, number, number];
    readonly editor_char_count: (a: number) => [number, number, number];
    readonly editor_char_to_byte: (a: number, b: number) => [number, number, number];
    readonly editor_char_to_line: (a: number, b: number) => [number, number, number];
    readonly editor_char_to_utf16: (a: number, b: number) => [number, number, number];
    readonly editor_clear: (a: number) => [number, number];
    readonly editor_create_buffer: (a: number, b: number) => void;
    readonly editor_delete: (a: number, b: number, c: number) => [number, number];
    readonly editor_get_buffer_text: (a: number, b: number) => [number, number, number, number];
    readonly editor_get_char: (a: number, b: number) => [number, number, number, number];
    readonly editor_get_line: (a: number, b: number) => [number, number, number, number];
    readonly editor_get_line_content: (a: number, b: number) => [number, number, number, number];
    readonly editor_get_lines: (a: number, b: number, c: number) => [number, number, number, number];
    readonly editor_get_range: (a: number, b: number, c: number) => [number, number, number, number];
    readonly editor_get_text: (a: number) => [number, number, number, number];
    readonly editor_get_text_from_byte: (a: number, b: number) => [number, number, number, number];
    readonly editor_has_buffer: (a: number, b: number) => number;
    readonly editor_insert: (a: number, b: number, c: number, d: number) => [number, number];
    readonly editor_line_count: (a: number) => [number, number, number];
    readonly editor_line_to_char: (a: number, b: number) => [number, number, number];
    readonly editor_new: () => number;
    readonly editor_remove_buffer: (a: number, b: number) => void;
    readonly editor_replace: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly editor_set_text: (a: number, b: number, c: number) => [number, number];
    readonly editor_switch_buffer: (a: number, b: number) => [number, number];
    readonly editor_utf16_length: (a: number) => [number, number, number];
    readonly editor_utf16_to_char: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
