import { invoke } from "@tauri-apps/api/core";
import { BackendAPI } from "./backend";
import { EditorModel } from "./editor";
import { DomUpdate } from "./Dom/tree";
import init, { FileStorage } from "./packages/core/core";
import types, { InitOutput  } from "./packages/core/core";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { SetPath, GetPath } from "./window";
import { event } from "@tauri-apps/api";
export const Path = "C:\\Users\\Client\\Desktop\\Projects\\BatataIDE";

export type RustFileEntry = {
    name: string;
    kind: "Unknown" | "File" | "Directory";
};

export interface WorkOperation {
    path: string;
    limit: number;
    parentId: number;
}

export interface Package {
    text: string,
    endPosition: number
    end: boolean;
}

export interface FileStats {
    totalPackages: number;
    totalLines: number;
    totalBytes: number;
    loadedPackages: number;
    loadedLines: number;
}

interface Recent {
    path: string,
    text: string,
    current: number,
}


export type FileType =  "Unknown" | "File" | "Directory";

export interface EventOptions {
    onConfirm: (name: string) => Promise<void>;
    onCancel: () => void;

    onInput?: (name: string) => void;
    onClose?: () => void;
}

export interface FileEntryDOM {
    element: HTMLElement;
    row: HTMLElement;
    name: HTMLSpanElement;
    icon: HTMLImageElement;
    input?: HTMLInputElement;
    actions?: HTMLElement;
    children?: HTMLElement;
    toggle?: HTMLImageElement;
}

export interface FileEntry {
    id?: number,
    name: string;
    kind: FileType;
    parent: number | null;
    path?: string,
    children?: Set<number>;
    loaded?: boolean;
    is_open: boolean;
    is_saved?: boolean;
    on_hover?: boolean;
    content?: string;
    rendered?: boolean;

    dom?: FileEntryDOM; // DOM elements
    element?: HTMLElement;
    toggleElement?: HTMLImageElement;
}

export interface TabInfo {
    name: string,
    path?: string,
    id: number,
}

type MoveElements = {
    type: string;
    action: "cut" | "copy";
    paths: string[];
};


let coreStorage: FileStorage | null = null;
let coreInit: Promise<InitOutput> | null = null;

export async function InitializeCore(): Promise<FileStorage> {
  if (!coreInit) {
    coreInit = init();
  }

  await coreInit;

  if (!coreStorage) {
    coreStorage = new FileStorage();
  }

  return coreStorage;
}

export function GetName(path: string): string { return path.split(/[\\/]/).filter(Boolean).pop() ?? ""; }
export function GetParts(path: string): string[] { return path.split(/[\\/]/).filter(Boolean); }

export abstract class FileManager {
    protected workers: WorkOperation[] = [];
    protected isManaging = false;

    protected nextId = 1;

    protected api: BackendAPI;
    protected dom!: DomUpdate;

    protected editor!: EditorModel;
    protected tab!: TabModel;
    
    protected opened_file: number;
    protected fileController: AbortController | null = null;

    protected inMenu = -1;
    protected inCreate = false;

    protected paste = false;
    protected storage: FileStorage;

    protected renderedIds = new Set<number>();
    private previousScrollTop = 0;


    constructor(
        protected readonly tree: HTMLElement,
        protected readonly scroll_frame: HTMLElement,
        protected path: string,
        storage: FileStorage
    ) {
        this.api = new BackendAPI();
        this.opened_file = 0;
        this.storage = storage;
    }

    public InitializeEvents(): void {
        this.EventInput();
    }

    public GenerateId(): number {
        return this.nextId++;
    }

    public SetView(view: DomUpdate): void {
        this.dom = view;
    }

    public SetTab(tab: TabModel): void {
        this.tab = tab;
    }

    public SetEditor(editor: EditorModel): void {
        this.editor = editor;
    }

    public pasteAvaiable(set_value: boolean | undefined = undefined) {
        if (!set_value) { return this.paste; }

        this.paste = set_value;
    }

    public async HandleSubFolder(id?: number): Promise<boolean | undefined> {
        if (!id) { return false; }

        return await this.InSubFolder(id);
    }

    public getSelectedElements() {
        return this.storage.get_selected_elements();
    }

    public async getMoved(): Promise<MoveElements | undefined> {
        const elements = await this.ReadClipboard();

        if (!elements) return undefined;
        if (elements.type !== "nerounIDE-file") return undefined;
        if (!["cut", "copy"].includes(elements.action)) return undefined;
        if (!Array.isArray(elements.paths)) return undefined;
        if (!elements.paths.every(path => typeof path === "string")) return undefined;

        return elements;
    }

    public async HandlePaste(to: number) {
        const moved = await this.getMoved();
        
        if (!moved) return;

        switch (moved.action) {
            case "cut": this.MovedElementsByPath(moved.paths, to);
            case "copy": this.CopyElementsByPath(moved.paths, to);
        }
    }

    public HandleCreateFolder(parentId: number): void {
        this.OpenFolder(parentId);

        const folder = this.dom.MakeFolder(parentId);
        if (!folder?.input) return;

        const register = (): void => {
            const name = folder.input!.value.trim();
            if (!name) return;

            this.CreateFolder(parentId, name);
        };

        const compare = (): boolean => {
            const name = folder.input?.value.trim() ?? "";

            return Boolean(this.GetElementByName(name));
        };
        this.dom.CreateEntry(folder, "Directory", false, register, compare, () => { this.inCreate = false; });
        this.inCreate = true;
    }

    public HandleCreateFile(parentId: number): void {
        this.OpenFolder(parentId);

        const file = this.dom.MakeFile(parentId);

        if (!file?.input) return;

        const register = (): void => {
            const name = file.input!.value.trim();
            if (!name) return;

            this.CreateFile(parentId, name);
        };

        const compare = (): boolean => {
            const name = file.input?.value.trim() ?? "";

            return Boolean(this.GetElementByName(name));
        };

        this.dom.CreateEntry(file, "File", false, register, compare, () => { this.inCreate = false; });
        this.inCreate = true;
    }

    public HandleExplorerOpen(id: number) {
        this.OpenExplorer(id);
    }

    public HandleRename(id: number): void {
        const input = this.dom.MakeRename(id);
        const element = this.GetElement_(id);
        const path = this.GetPath_(id);


        if (!input || !element) return;

        const register = async (): Promise<void> => {
            const newName = input.input?.value.trim();
            if (!newName) return;
            
            this.RenameElement(id, newName);
        };

        const compare = (): boolean => {
            const name = input.input?.value.trim() ?? "";

            return Boolean(this.GetElementByName(name));
        };

        this.dom.CreateEntry(input, element.kind, true, register, compare, () => {});
    }

    public HandleDelete() {
        this.dom.ShowWarning(() => { return; }, () => { this.DeleteElement(); });
    }

    public HandleCut() {
        this.CutElements();
    }

    public HandleCopy() {
        this.CopyElements();
    }

    public HandleNewWindow(id: number) {
        this.api.NewWindow(this.GetPath_(id));
    }

    private EventInput(): void {
        this.scroll_frame.addEventListener("scroll", () => {
            const rowHeight = 22;
            const buffer = 60;

            const scrollTop = this.scroll_frame.scrollTop;
            const viewportHeight = this.scroll_frame.clientHeight;

            const totalCount = this.storage.get_visible_count();

            const firstIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
            const lastIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);

            const currentIds = new Set<number>();
            const fragment = document.createDocumentFragment();
            const direction = firstIndex < this.previousScrollTop ? "Up" : "Down";

            for (let i = firstIndex; i < lastIndex; i++) {
                const id = this.storage.get_visible_element(i);

                if (id === undefined) continue;

                currentIds.add(id);

                if (this.renderedIds.has(id)) continue; 
                const child = this.dom.RenderChild(id, this.storage.get_parent(id) ?? null, false);
                if (child) { fragment.appendChild(child); }
            }

            for (const id of this.renderedIds) {
                if (id === 1) continue;

                if (!currentIds.has(id)) {
                    this.dom.UnrenderChild(id);
                    this.renderedIds.delete(id);
                }
            }

            this.dom.RenderAllChildren(1, fragment, direction);
            this.renderedIds = currentIds;
            this.previousScrollTop = firstIndex;

            this.tree.style.paddingTop = `${firstIndex * rowHeight}px`;
            this.tree.style.paddingBottom = `${Math.max(0, totalCount - lastIndex) * rowHeight}px`;
        });


        this.tree.addEventListener("mousedown", (event: MouseEvent) => {
            if (event.button !== 0) return;

            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const action = target.closest<HTMLElement>(".tree-actions [data-action]");

            if (action) {
                event.stopPropagation();

                const parentId = Number(action.dataset.parentId);
                if (!Number.isFinite(parentId)) return;

                this.dom.CloseCreateUI();
                this.inCreate = false;

                switch (action.dataset.action) {
                    case "new-folder": this.HandleCreateFolder(parentId); break;
                    case "new-file": this.HandleCreateFile(parentId); break;
                }

                return;
            }

            if (this.inCreate) { event.stopPropagation(); return; }

            const entry = target.closest<HTMLElement>(".folder, .file"); if (!entry) return;
            const id = Number(entry.dataset.id);

            if (entry.classList.contains("folder")) {
                if (!event.ctrlKey) {
                    this.UnSelectAll();
                    this.OnFolderClick(id);
                }

                this.OnSelectElement(id);
            } else if (entry.classList.contains("file")) {
                if (!event.ctrlKey) {
                    this.UnSelectAll();
                    this.OnFileClick(id);
                    this.tab.OpenTab(id);
                }

                this.OnSelectElement(id);
            }
        });

        this.tree.addEventListener("contextmenu", (event: MouseEvent) => {
            event.preventDefault();

            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const entry = target.closest<HTMLElement>(".folder, .file");
            const id = entry ? Number(entry.dataset.id) : 0;

            if (!Number.isFinite(id) || id <= 0 || !this.storage.contains(id)) return;

            if (this.storage.get_selected_elements().length === 1) {
                this.UnSelectAll();
            }

            this.OnExitElementHover(this.inMenu, true);
            this.inMenu = id;
            this.OnSelectElement(id);

            void this.dom.ShowMessage(id, event.clientX, event.clientY, () => {
                this.inMenu = -1;
                this.OnExitElementHover(id);
            });
        });

        this.tree.addEventListener("mouseover", (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const item = target.closest<HTMLElement>(".file, .folder");
            if (!item) return;
            if (!item.dataset.id) { return; }

            this.OnElementHover(Number(item.dataset.id)); 
        });

        this.tree.addEventListener("mouseout", (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const item = target.closest<HTMLElement>(".file, .folder");
            if (!item) return;

            const id = Number(item.dataset.id);
            if (!Number.isFinite(id) || id <= 0) return;

            if (this.storage.is_selected(id)) return;

            this.OnExitElementHover(id);
        });
            
        document.addEventListener("keydown", async (event: KeyboardEvent) => {
            if (event.key !== "Delete") return;

            event.preventDefault();

            await this.DeleteElement();
        });

        document.addEventListener("mousedown", (event: MouseEvent) => {
            if (this.inMenu !== -1) { return; }
            const target = event.target;

            if (!(target instanceof HTMLElement)) return;

            if (target.closest(".folder, .file")) return;
            if (target.closest(".tree-actions")) return;

            this.UnSelectAll();
        });
    }

    protected CutElements(): void {}
    protected OpenExplorer(id: number): void {}
    protected OpenFile(id: number): void {}
    protected OpenFolder(id: number): void {}
    protected OnFolderClick(id: number): void {}
    protected OnFileClick(id: number, onCreate = false): void {}
    protected OnSelectElement(id: number): void {}
    protected OnElementHover(id: number): void {}
    protected OnExitElementHover(id: number, overwrite = false): void {}
    protected RenameElement(id: number, newName: string): void {}
    protected UnSelectAll(): void {}

    protected async MovedElementsByPath(paths: string[], to: number): Promise<void> {}
    protected async CopyElementsByPath(paths: string[], to: number): Promise<void> {}
    protected async CopyElements(): Promise<void> {}
    protected async DeleteElement(): Promise<void> {}

    protected abstract CreateFolder(parentId: number, name: string): Promise<number>;
    protected abstract CreateFile(parentId: number,name: string): Promise<number>;
    protected abstract InSubFolder(id: number): Promise<boolean | undefined>;
    protected abstract ReadClipboard(): Promise<MoveElements | undefined>;
    protected abstract GetElement_(id: number, is_project?: boolean): FileEntry | undefined;
    protected abstract GetPath_(id: number): string;
    protected abstract GetElementByName(name: string, parentId?: number | null): FileEntry | undefined;
}

export class ExplorerModel extends FileManager {
    constructor(tree: HTMLElement, explorer_frame: HTMLElement, path: string, storage: FileStorage) {
        super(tree, explorer_frame, path, storage);
    }

    protected GetElementByName(name: string | undefined, parentId: number | null = null): FileEntry | undefined {
        if (!name) return undefined;

        // Check this
        const ids = parentId !== null ? this.storage.get_children(parentId) : this.storage.get_all_ids();

        for (const id of ids) {
            const element = this.GetElement(id);

            if (!element) continue;
            if (element.name === name) return element;
        }

        return;
    }
    

    public setPath(path: string) {
        SetPath(path);
        this.path = path;
    }

    public addProject(path: string, info: FileEntry): number {
        const kind = info.kind === "File" ? 0 : info.kind === "Directory" ? 1 : 2;

        return this.storage.add_element(info.name, kind, undefined, path);
    }

    protected override OpenExplorer(id: number) {
        this.api.OpenExplorer(this.GetPath(id));
    }

    protected async InSubFolder(id: number): Promise<boolean> {
        if (this.storage.is_cutted(id)) {
            return true;
        }

        const elements = await this.getMoved();
        const path = this.GetPath(id);
        
        if (!elements) return false;

        return elements.paths.includes(path);
    }

    public SaveFile(id: number | null, asExt = false) {
        if (id === null) {
            this.api.SaveFile(this.GetPath(this.opened_file), this.editor.GetSaved(), asExt);
            this.editor.RemoveContext(this.opened_file);
            return;
        }

        this.api.SaveFile(this.GetPath(id), this.editor.GetSavedForContext(id), asExt);
        this.editor.RemoveContext(id);
    }

    protected override async CopyElementsByPath(paths: string[], to: number): Promise<void> {
        this.storage.clear_copied_elements();

        const target = this.GetElement(to);
        if (!target || target.kind !== "Directory") return;

        const targetPath = this.GetPath(to);
        const types: FileType[] = await this.api.GetType(paths);

        await this.api.CopyElements(paths, targetPath);

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            const name = GetName(path);

            const source = this.GetElementByName(name);
            const kind = source?.kind ?? types[i];

            const kindValue = kind === "File" ? 0 : kind === "Directory" ? 1 : 2;
            const id = this.storage.add_element(name, kindValue, to);

            if (kind === "Directory") {
                this.storage.set_loaded(id, false);
                this.storage.set_open(id, false);
            }
        }

        this.dom.RenderChildren(to, this.SortElements(to));
    }

    protected override async MovedElementsByPath(paths: string[], to: number): Promise<void> {
        this.storage.clear_copied_elements();

        const target_path = this.GetPath(to);
        const target_element = this.GetElement(to);

        let lastIndex = 0;
        let affectedParents: number[] = [];

        this.api.MoveElements(paths, target_path);

        for (const path of paths) {
            const name = GetName(path);
            let id = 0;

            const element = this.GetElementByName(name);
            if (!element || !target_element || !element.element) continue;
            const parent = this.GetElement(element.parent ?? -1);
            if (!parent) continue;

            id = element.id!;

            target_element.children ??= new Set<number>();
            parent.children?.delete(id);

            element.element.style.opacity = "1";
            element.parent = to;
            target_element.children.add(id);
            
            affectedParents.push(parent.id ?? -1);
            affectedParents.push(target_element.id ?? -1);
   
            lastIndex += 1;
        }
        
        for (const parentId of affectedParents) {
            this.dom.RenderChildren(parentId, this.SortElements(parentId));
        }

        this.dom.RenderChildren(to, this.SortElements(to));
    }

    protected override async DeleteElement(): Promise<void> {
        for (const id of this.storage.get_selected_elements()) {
            const parent = this.GetElement(id); if (!parent) { return; }
            const path = this.GetPath(id);
            const elements: number[] = [];
            let index = 0;

            while (index < elements.length) {
                const currentId = elements[index++];
                const child = this.GetElement(currentId);

                if (!child) continue;
                if (child.children) { elements.push(...child.children); }
            }

            await this.api.DeleteElement(path).catch((error) => {
                console.error("Deletion failed:", error);
                return;
            });

            for (const id of elements) {
                const element = this.GetElement(id);

                element?.element?.remove();
                this.storage.remove_element(id);

                await new Promise<void>(resolve => {
                    requestAnimationFrame(() => resolve());
                });
            }
            
            parent.element?.remove();
            this.storage.remove_element(id);
        }
    }
 
    protected override OnFolderClick(id: number): void {
        const entry = this.GetElement(id);

        if (!entry || entry.kind !== "Directory") return;

        const isOpen = this.storage.get_open(id);
        const toggle = this.dom.GetDOM(id)?.toggle;

        this.storage.set_open(id, !isOpen);

        if (toggle) {
            toggle.src = isOpen ? "/icons/closed_folder.svg" : "/icons/down.svg";
        }

        if (isOpen) {
            this.dom.UnrenderChildren(id);
            this.storage.close_directory(id);
            this.UpdateScrollHeight();
        } else {
            this.QueueScan(this.GetPath(id), 50, id);
        }
    }

    protected override OpenFolder(id: number): void {
        const entry = this.GetElement(id);

        if (!entry || entry.kind !== "Directory") return;

        const dom = this.dom.GetDOM(id);
        if (dom?.toggle) {
            dom.toggle.src = "/icons/down.svg";
        }

        this.storage.set_open(id, true);
        this.QueueScan(this.GetPath(id), 50, id);
    }

    protected override OnSelectElement(id: number): void {
        const element = this.GetElement(id);
        if (!element) return;

        const row = this.GetElementRow(element);
        if (!row) return;

        row.style.backgroundColor = "rgba(27, 76, 145, 0.15)";
        this.storage.add_selected_element(id);
    }

    protected override OnExitElementHover(id: number, overwrite = false): void {
        const element = this.GetElement(id);
        if (!element) return;

        if (this.storage.is_selected(id)) return;
        if (this.storage.is_cutted(id)) return;

        const row = this.GetElementRow(element);
        if (!row) return;

        if (this.inMenu === id && overwrite === false) return;

        const isOpen = this.storage.get_open(id);

        row.style.backgroundColor = element.kind === "File" && isOpen ? "rgba(75, 85, 99, 0.15)" : "";
    }

    protected override OnElementHover(id: number): void {
        const element = this.GetElement(id);
        if (!element) return;

        if (this.storage.is_selected(id)) return;

        const row = this.GetElementRow(element);
        if (!row) return;

        row.style.backgroundColor = "rgba(59, 130, 246, 0.12)";
    }

    protected override async RenameElement(id: number, newName: string): Promise<void> {
        const entry = this.GetElement(id);

        if (!entry || entry.parent === null) return;

        newName = newName.trim();

        if (!newName || newName === entry.name) return;

        await this.api.RenameElement(this.GetPath(id), newName);

        const dom = this.dom.GetDOM(id);

        if (!dom) return;

        dom.name.textContent = newName;
        dom.icon.src = entry.kind === "Directory" ? this.dom.GetFolderIcon(newName) : this.dom.GetFileIcon(newName);
        dom.element.dataset.name = newName;

        this.tab.RenderTabs();
    }

    protected override async CutElements(): Promise<void> {
        const previousCutIds = this.storage.get_cutted_elements();

        for (const id of previousCutIds) {
            const element = this.GetElement(id);      if (!element) continue;
            const row = this.GetElementRow(element);  if (!row) continue;

            row.style.opacity = "1";
        }

        this.storage.clear_cutted_elements();

        const elements = this.storage.get_selected_elements();

        const data: MoveElements = {
            type: "nerounIDE-file",
            action: "cut",
            paths: Array.from(elements, id => this.GetPath(id as number))
        };

        try {
            await navigator.clipboard.writeText(JSON.stringify(data));
        } catch (error) {
            console.error("Failed to write clipboard:", error);
            return;
        }

        for (const id of elements) {
            this.storage.add_cutted_element(id);

            if (id === this.opened_file) continue;

            const element = this.GetElement(id);
            if (!element) continue;

            const row = this.GetElementRow(element);
            if (!row) continue;

            row.style.opacity = "0.6";
        }
    }

    protected override async CopyElements(): Promise<void> {
        this.storage.clear_copied_elements();

        const elements = this.storage.get_selected_elements();

        const data: MoveElements = {
            type: "nerounIDE-file",
            action: "copy",
            paths: Array.from(elements, id => this.GetPath(id as number))
        };

        try {
            await navigator.clipboard.writeText(JSON.stringify(data));
        } catch (error) {
            console.error("Failed to write clipboard:", error);
            return;
        }

        for (const id of elements) {
            this.storage.add_copied_element(id);
        }
    }

    protected override async ReadClipboard(): Promise<MoveElements | undefined> {
        try {
            const clipboard = await this.api.ReadFileClipboard();
            if (!clipboard) { return; }

            return JSON.parse(clipboard) as MoveElements;
        } catch (error) {
            return undefined;
        }
    }

    public OpenFile(id: number) {
        this.OnFileClick(id);
    }

    protected override UnSelectAll(): void {
        const selectedIds = this.storage.get_selected_elements();

        for (const id of selectedIds) {
            const element = this.GetElement(id);
            if (!element) continue;

            if (element.is_open && element.kind === "File") {
                continue;
            }

            const row = this.GetElementRow(element);
            if (!row) continue;

            row.style.backgroundColor = "";
        }

        this.storage.clear_selected_elements();
    }

    protected override async OnFileClick(id: number) {
        this.fileController?.abort();
        this.fileController = new AbortController();

        const signal = this.fileController.signal;

        const file = this.GetElement(id);
        const originalFile = this.GetElement(this.opened_file);

        if (!file) return;
        if (this.storage.get_open(id)) return;

        if (originalFile) {
            this.storage.set_open(this.opened_file, false);

            if (originalFile.element) { originalFile.element.style.backgroundColor = ""; }
        }

        this.opened_file = id;
        const filePath = document.getElementById("file-path");

        if (filePath) {
            const parts = GetParts(this.GetPath(id));
            const folder = GetParts(this.path).pop();

            const pathIndex = parts.indexOf(folder!);
            const displayPath = pathIndex !== -1 ? "../" + parts.slice(pathIndex).join("/") : parts.pop() ?? "";

            filePath.textContent = displayPath;
        }

        if (file.element) {
            file.element.style.backgroundColor = "rgba(75, 85, 99, 0.15)";
        }

        this.storage.set_open(id, true);

        if (!this.editor.HasContext(id)) {
            this.editor.CreateContext(id);

            const path = this.GetPath(id);
            const predenting: Package[] = [];

            let lastPosition = 0;
            let lastIndex = 0;
            let processing = false;
            let rendered = false;
            let firstLoad = true;

            const getInitialChunkSize = (): number => {
                const charWidth = 7.697265625;
                const lineHeight = 21;

                const columns = Math.floor(screen.width / charWidth);
                const rows = Math.floor(screen.height / lineHeight);

                return columns * rows;
            };

            const processQueue = async () => {
                if (processing || signal.aborted) return;

                processing = true;

                try {
                    while (lastIndex < predenting.length && !signal.aborted) {
                        const pack = predenting[lastIndex++];
                        await this.editor.Insert(pack.text);

                        if (signal.aborted) return;
                        if (!rendered) { await this.editor.NewRender(); rendered = true; }
                    }
                } finally {
                    processing = false;

                    if (lastIndex < predenting.length && !signal.aborted) {
                        void processQueue();
                    }
                }
            };

            while (!signal.aborted) {
                const value = firstLoad ? getInitialChunkSize() : 0;
                const pack = await this.api.ReadFile(path, lastPosition, firstLoad ? value : 256 * 1024);

                // Incase nothing to render
                if (firstLoad && pack.text.length === 0 && pack.end) {
                    await this.editor.NewRender();
                    return;
                }

                if (signal.aborted) return;
                if (pack.text.length > 0) { predenting.push(pack); void processQueue(); }

                lastPosition += pack.endPosition;
                firstLoad = false;

                if (pack.end) break;
            }

            if (signal.aborted) return;

            await processQueue();

            if (signal.aborted) return;

            this.storage.set_content(id, this.editor.GetSaved());
            return;
        }

        if (signal.aborted) return;

        this.editor.SwitchContext(id);
    }

    private UpdateScrollHeight(): void {
        this.scroll_frame.dispatchEvent(new Event("scroll"));
    }

    private SortElements(parentId: number): number[] {
        return Array.from(this.storage.get_children(parentId));
    }

    public QueueScan(path: string, limit: number, parentId: number): void {
        const dir = this.GetElement(parentId);

        if (!dir || dir.kind !== "Directory") return;
        if (dir.loaded) {
            this.dom.RenderChildren(parentId, this.SortElements(parentId).slice(0, 50));
            this.storage.open_directory(parentId);
            this.UpdateScrollHeight();
            return;
        }

        void this.ScanDirectory(path, parentId);
    }

    private async ScanDirectory(path: string, parentId: number): Promise<void> {
        try {
            const entries = await this.api.OpenDirectory(path, null);
            if (!entries) return;

            this.ManageElements(parentId, entries);

            const sortedElements = this.SortElements(parentId);

            this.storage.open_directory(parentId);
            this.dom.RenderChildren(parentId, sortedElements.slice(0, 50));
            this.UpdateScrollHeight();
        } catch (error) {
            console.error(error);
        }
    }

    private ManageElements(parentId: number, entries: RustFileEntry[]): void {
        const parent = this.GetElement(parentId);
        if (!parent || parent.kind !== "Directory") return;

        for (const entry of entries) {
            const kind = entry.kind === "File" ? 0 : entry.kind === "Directory" ? 1 : 2;
            this.storage.add_element(entry.name, kind, parentId);
        }

        this.storage.set_loaded(parentId, true);
    }

    public override async CreateFolder(parentId: number, name: string): Promise<number> {
        const parent = this.GetElement(parentId);

        if (!parent || parent.kind !== "Directory") {
            throw new Error(`Parent directory ${parentId} not found`);
        }

        await this.api.CreateFolder(this.GetPath(parentId), name);
        const id = this.storage.add_element(name, 1, parentId);

        this.storage.set_loaded(parentId, true);
        this.storage.set_open(parentId, true);

        this.dom.RenderChildren(parentId, this.SortElements(parentId));

        return id;
    }

    public override async CreateFile(parentId: number, name: string): Promise<number> {
        const parent = this.GetElement(parentId);

        if (!parent || parent.kind !== "Directory") {
            throw new Error(`Parent directory ${parentId} not found`);
        }

        await this.api.CreateFile(this.GetPath(parentId), name);

        const id = this.storage.add_element(name, 0, parentId);

        this.storage.set_loaded(parentId, true);
        this.storage.set_open(parentId, true);

        this.dom.RenderChildren(parentId, this.SortElements(parentId));

        return id;
    }

    public RegisterFile(name: string, path: string) {
        return this.storage.add_element(name, 0, undefined, path);
    }

    public UpdateExplorer(): void {
        const tree = document.getElementById("tree");

        if (!tree) {
            console.error('Element "#tree" not found');
            return;
        }

        tree.replaceChildren();

        for (const id of this.storage.get_all_ids()) {
            const entry = this.GetElement(id);

            if (!entry || entry.kind !== "Directory") continue;

            this.dom.Render(entry, tree);
        }
    }

    protected override GetPath_(id: number): string {
        return this.GetPath(id);
    }

    protected override GetElement_(id: number, is_project = false): FileEntry | undefined {
        return this.GetElement(id, is_project);
    }

    private GetElementRow(element: FileEntry): HTMLElement | null {
        if (element.id === undefined) return null;

        return this.dom.GetDOM(element.id)?.row ?? null;
    }


    public GetElement(id: number, is_project = false): FileEntry | undefined {
        if (!this.storage.contains(id)) return undefined;

        const name = this.storage.get_name(id) ?? "";
        const kind = this.storage.get_kind(id);
        const parent = this.storage.get_parent(id);

        return {
            id,
            name,
            kind: kind === 0 ? "File" : kind === 1 ? "Directory" : "Unknown",
            parent: parent ?? null,

            path: this.storage.get_path(id) ?? undefined,
            is_open: this.storage.get_open(id),
            loaded: this.storage.get_loaded(id),
        };
    }

    public GetPath(id: number): string {
        const entry = this.GetElement(id);

        if (entry?.path) { return entry.path }
        if (!entry) {
            throw new Error(`Element with ID ${id} was not found`);
        }

        if (entry.parent === null) {
            return this.path;
        }

        return `${this.GetPath(entry.parent)}\\${entry.name}`;
    }

    public HasElementByPath(path: string) {
        for (const id of this.storage.get_all_ids()) {
            const path = this.GetPath(id);

            if (path === path) { return true; }
        } 

        return false;
    }

    public ResetExplorer(): void {
        this.storage.clear();
        this.renderedIds.clear();

        this.scroll_frame.scrollTop = 0;
    }
}

export class TabModel {
    private selectedFileId: number | null = null;
    private openFileIds: number[] = [];
    private dom: DomUpdate;
    private explorer: ExplorerModel;
    private editor!: EditorModel;
    private tab: HTMLElement;
    private selectedTab: HTMLElement | null;
    constructor(dom: DomUpdate, explorer: ExplorerModel, tab: HTMLElement) {
        this.dom = dom;
        this.explorer = explorer;
        this.tab = tab;
        this.selectedTab = null;
        
        this.EventInput();
    }

    public SetEditor(editor: EditorModel) {
        this.editor = editor;
    }

    private EventInput(): void {
        this.tab.addEventListener("mousedown", (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const id = target.dataset.id;
    
            if (id === undefined) { return; }
            if (Number(id) === this.selectedFileId) { return; }

            target.classList.add("selected_file");
            target.style.backgroundColor = "#202020";

            if (this.selectedTab) { 
                this.selectedTab.classList.remove("selected_file");
                this.selectedTab.style.backgroundColor = "";
            }

            this.selectedTab = target;
            this.selectedFileId = Number(id);
            this.explorer.OpenFile(Number(id));
        });

        this.tab.addEventListener("mouseover", (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            target.style.backgroundColor = "#202020";
        });

        this.tab.addEventListener("mouseout", (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const id = target.dataset.id;

            if (Number(id) === this.selectedFileId) { return; }
            target.style.backgroundColor = "";
        });
    }
    
    public OpenTab(fileId: number): void {
        if (!this.IsOpen(fileId)) { this.openFileIds.push(fileId); }

        this.selectedFileId = fileId;
        this.RenderTabs();
    }

    public RenderTabs() {
        const paths: Set<string> = new Set();
        const names: Set<string> = new Set();
        const entries: TabInfo[] = [];
        
        for (const fileId of this.GetOpenFileIds()) {
            const element = this.explorer.GetElement(fileId);
            if (!element) { return; }

            const path = paths.has(element.path ?? "");
            const name = names.has(element.name);

            if (path && name) { continue; }

            entries.push({ name: element.name, path: element.path, id: fileId });

            paths.add(element.path ?? this.explorer.GetPath(fileId));
            names.add(element.name);
        }
        
        this.dom.RenderTabs(entries, this.selectedFileId ?? 0, (element: HTMLElement) => { this.selectedTab = element; });
    }

    public IsSelected(fileId: number): boolean { return this.selectedFileId === fileId; }
    public IsOpen(fileId: number): boolean { return this.openFileIds.includes(fileId); }
    public GetOpenFileIds(): readonly number[] { return this.openFileIds; }
    public GetSelectedFileId(): number | null { return this.selectedFileId; }

    public HasElementByName(name: string) {
        for (const id of this.openFileIds) {
            const element_name = this.explorer.GetElement(id)?.name;

            if (name === element_name) { return true; }
        }

        return false;
    }

    public HasElementByPath(path: string) {
        for (const id of this.openFileIds) {
            const element_path = this.explorer.GetElement(id)?.path;

            if (path === element_path) { return true;}
        }

        return false;
    }

    public ResetTab() {
        this.selectedFileId = 0;
        this.openFileIds = [];
    }
}

export class MenuModel {
    private path: string;
    private selected_path: string;

    private menuPopup!: HTMLElement;
    private menu: HTMLElement;
    private explorer: ExplorerModel;
    private apis: BackendAPI;
    private tab: TabModel;
    private dom: DomUpdate
    private recent!: HTMLElement | null;
    private recent_more!: HTMLElement | null;
    private isMenuOpen = false;
    private menuWidth = 0;

    constructor(menu: HTMLElement, explorer: ExplorerModel, tab: TabModel, dom: DomUpdate, path: string) {
        this.path = path;
        this.selected_path = "";
        this.menu = menu;
        this.dom = dom;
        this.explorer = explorer;
        this.tab = tab;
        this.apis = new BackendAPI();

        this.EventInput();
    }

    private EventInput() {
        this.menu.addEventListener("mousedown", async (event: MouseEvent) => {
            if (this.isMenuOpen) { this.CloseMenu(); return; }

            const target = event.target as HTMLElement;
            const menuIcon = target.closest("#menu");

            if (menuIcon instanceof HTMLElement) {
                const rect = menuIcon.getBoundingClientRect();

                this.isMenuOpen = true;
                await this.dom.ShowMenu(rect.left, rect.bottom, this, 
                    (element: HTMLElement) => { this.menuPopup = element; }, 
                    (size: number) => { this.menuWidth = size }, 
                    () => { this.CloseMenu() 
                });
            }
        });
    }
    
    private CloseMenu() {
        this.recent?.remove();
        this.recent_more?.remove();        
        this.menuPopup.remove();

        this.recent = null;
        this.recent_more = null;
        this.isMenuOpen = false;
    }

    private OpenFolder(path: string) {        
        const folderName = GetName(path);

        this.apis.WriteRecent(path, Math.floor(Date.now() / 1000).toString());
        this.explorer.ResetExplorer();
        this.tab.ResetTab();
        this.dom.ResetDom();

        this.explorer.setPath(path);
        this.explorer.addProject(path, {
            name: folderName,
            kind: "Directory",
            parent: null,
            path: path,
            is_open: false,
        });

        this.explorer.UpdateExplorer();
    }

    public async HandleOpenFile() {
        const path = await this.apis.OpenFile(this.path);

        if (!path) return;

        const fileName = GetName(path);
        if (this.tab.HasElementByPath(path)) { return; }

        const id = this.explorer.RegisterFile(fileName, path);

        this.explorer.OpenFile(id);
        this.tab.OpenTab(id);
    }

    public async HandleOpenFolder() {
        const path = await this.apis.OpenFolder(this.path);

        if (!path) return; 

        this.OpenFolder(path);
    }

    public async HandleNewFile() {
        const path = await this.apis.NewFile(this.path);
        
        if (!path) return; 

        const fileName = GetName(path);
        if (this.tab.HasElementByPath(path)) { return; }
        
        const id = this.explorer.RegisterFile(fileName, path);
        
        this.explorer.OpenFile(id);
        this.tab.OpenTab(id);
    }

    public async HandleNewWindow() {
        this.apis.NewWindow();
    }

    public async HandleSave() {
        this.explorer.SaveFile(null);
    }

    public async HandleSaveAll() {
        for (const id of this.tab.GetOpenFileIds()) { this.explorer.SaveFile(id); }
    }

    public async HandleSaveAs() {
        this.explorer.SaveFile(null, true);
    }

    public async HandleExit(save = false) {
        if (save) {
            await this.HandleSaveAll();
        }

        await getCurrentWindow().close();
    }

    public async HandleRecent(x: number, y: number) {
        if (this.recent) {
            this.recent.remove();
            this.recent = null;
            return;
        }

        this.recent = await this.dom.ShowRecent(x, y, this.menuWidth);
        const recent = await this.apis.GetRecent();

        let recentList: Recent[] = [];

        for (const [path, info] of Object.entries(recent as Record<string, { Date: string }>)) {
            const date = new Date(Number(info.Date) * 1000);
            const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);

            switch (true) {
                case diff === 0: recentList.push({ path: path, text: "Today", current: 1 }); break;
                case diff === 1: recentList.push({ path: path, text: "Yestorday", current: 2 }); break;

                case diff > 1 && diff < 7: recentList.push({ path: path, text: "Last Week", current: 3 }); break;
                case date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(): recentList.push({ path: path, text: "Last Month", current: 4 }); break;
                case date.getFullYear() === now.getFullYear() - 1: recentList.push({ path: path, text: "Last Year", current: 5 }); break;
            }
        }
        
        for (const [index, recent] of recentList.entries()) {
            this.dom.AddRecent(this.recent, recent.path, recent.text, index !== recentList.length - 1);
        }

        this.recent.addEventListener("mousedown", async (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const selection = target.closest(".selection") as HTMLElement | null;
            const path = selection?.dataset.path;
            const more = target.closest(".selection-shortcut-icon") as HTMLElement | null;

            if (more?.dataset.type === "more") {
                event.stopPropagation();

                const selection = more.closest(".selection") as HTMLElement | null;
                const path = selection?.dataset.path;
                const x = this.recent?.getBoundingClientRect().left ?? 0;
                const y = selection?.getBoundingClientRect().top ?? 0;
                const width = this.recent?.getBoundingClientRect().width ?? 0;
                const selectedElement = selection;
        
                if (this.recent_more && this.selected_path === path) {
                    this.recent_more.remove();
                    this.recent_more = null;

                    return;
                }

                this.selected_path = path ?? "";
                this.recent_more = await this.dom.ShowMore_Recent(path ?? "", width, x, y);
                this.recent_more?.addEventListener("mousedown", async (event: MouseEvent) => {
                    event.stopPropagation();

                    const target = event.target as HTMLElement;
                    const action = target.closest(".selection") as HTMLElement | null;

                    if (!action) return;

                    switch (action.id) {
                        case "open":  this.OpenFolder(this.selected_path); this.CloseMenu(); break;
                        case "copy": await navigator.clipboard.writeText(this.selected_path); break;
                        case "new_window": this.apis.NewWindow(this.selected_path); break;
                        case "explorer": this.apis.OpenExplorer(this.selected_path); break;
                        case "delete":
                            this.dom.ShowWarning(() => { return; }, () => { 
                                this.apis.DeleteElement(this.selected_path).catch(() => { return; });
                                this.dom.RemoveRecent(selectedElement);
                                this.apis.RemoveRecent(path ?? "");
                                this.recent_more?.remove();
                            });
                        break;

                        case "more": break;
                    }
                });
                return;
            }
            
            if (!path) { return; }
            this.OpenFolder(path);
        });
    }
}

async function main(window_path?: string): Promise<void> {
    const path = window_path || GetPath() || Path;

    if (!path) {
        return;
    }

    console.log("path:", path);

    const scroll_frame = document.getElementById("scroll_frame");
    const tree = document.getElementById("tree");
    const menu_element = document.getElementById("top_options");
    const file_pos = document.getElementById("file_pos");

    if (!tree) {
        throw new Error('Element "#tree" not found');
    }

    if (!menu_element) {
        throw new Error('Element "#top_options" not found');
    }

    if (!scroll_frame) {
        throw new Error('Element "#menu_element" not found');
    }

    if (!file_pos) {
        throw new Error('Element "#file_pos" not found');
    }

    const storage = await InitializeCore();
    const model = new ExplorerModel(tree, scroll_frame, path, storage);
    const view = new DomUpdate(model);
    const tab = new TabModel(view, model, file_pos);
    const editor = new EditorModel();
    const menu = new MenuModel(menu_element, model, tab, view, path);

    model.SetView(view);
    model.SetTab(tab);

    await editor.init();

    model.SetEditor(editor);
    tab.SetEditor(editor);

    model.InitializeEvents();
    (window as any).editorModel = editor;

    model.addProject(path, {
        name: GetName(path),
        kind: "Directory",
        parent: null,
        path: path,
        is_open: false,
    });

    model.UpdateExplorer();
}

const params = new URLSearchParams(window.location.search);
const path = params.get("path");

main(path ?? "");