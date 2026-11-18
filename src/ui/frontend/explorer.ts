import { invoke } from "@tauri-apps/api/core";
import { BackendAPI } from "./backend";
import { EditorModel } from "./editor";
import { DomUpdate } from "./Dom/tree";
import { event } from "@tauri-apps/api";
import { Position } from "@tauri-apps/api/dpi";
import { FileStorage } from "../packages/core/core";

export const Path = "C:\\Users\\Client\\Desktop\\Projects";

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

type MoveElements = {
    type: string;
    action: "cut" | "copy";
    paths: string[];
};

let coreStorage: FileStorage | null = null;

export async function InitializeCore(): Promise<FileStorage> {
    if (!coreStorage) {
        coreStorage = new FileStorage();
    }

    return coreStorage;
}

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

    constructor(
        protected readonly tree: HTMLElement,
        protected readonly path: string,
        storage: FileStorage
    ) {
        this.api = new BackendAPI();
        this.opened_file = 0;
        this.storage = storage;
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
        const path = this.GetPath_(parentId);
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
        const path = this.GetPath_(parentId);

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
            
            await this.RenameElement(id, newName);
        };

        const compare = (): boolean => {
            const name = input.input?.value.trim() ?? "";

            return Boolean(this.GetElementByName(name));
        };

        this.dom.CreateEntry(input, element.kind, true, register, compare, () => {});
    }

    public HandleDelete() {
        this.DeleteElement();
    }

    public HandleCut() {
        this.CutElements();
    }

    public HandleCopy() {
        this.CopyElements();
    }

    private EventInput(): void {
        // Will not be implemented now
        // Coming soon.

        // this.tree.addEventListener("scroll", () => {
        //     const rowHeight = 26;
        //     const buffer = 20;

        //     const scrollTop = this.tree.scrollTop;
        //     const viewportHeight = this.tree.clientHeight;

        //     const startPosition = Math.max(0, scrollTop - buffer * rowHeight);
        //     const endPosition = scrollTop + viewportHeight + buffer * rowHeight;

        //     const firstIndex = Math.floor(startPosition / rowHeight);
        //     const lastIndex = Math.ceil(endPosition / rowHeight);

        //     const render = this.visibleRows.slice(firstIndex, lastIndex);

        // });

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
    protected OpenFile(id: number, onCreate = false): void {}
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
    constructor(tree: HTMLElement,path: string, storage: FileStorage) {
        super(tree, path, storage);
    }

    protected GetElementByName(name: string | undefined, parentId: number | null = null): FileEntry | undefined {
        if (!name) return undefined;

        const ids = parentId !== null ? this.storage.get_children(parentId) : this.storage.get_all_ids();

        for (const id of ids) {
            const element = this.GetElement(id);

            if (!element) continue;
            if (element.name === name) return element;
        }

        return;
    }

    public addProject(path: string, info: FileEntry): number {
        const kind = info.kind === "File" ? 0 : info.kind === "Directory" ? 1 : 2;
        const id = this.storage.add_element(info.name, kind);

        return id;
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

    protected override async CopyElementsByPath(paths: string[], to: number): Promise<void> {
        this.storage.clear_copied_elements();

        const target = this.GetElement(to);
        if (!target || target.kind !== "Directory") return;

        const targetPath = this.GetPath(to);
        const types: FileType[] = await this.api.GetType(paths);

        await this.api.CopyElements(paths, targetPath);

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            const name = path.split(/[\\/]/).filter(Boolean).pop() ?? "";

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
            const name = path.split(/[\\/]/).filter(Boolean).pop();
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

            try {
                await this.api.DeleteElement(path);
            } catch (error) {
                console.error("Deletion failed:", error);
                return;
            }

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

        this.dom.RenderTabs(this.tab, this);
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
            paths: Array.from(elements, id => this.GetPath(id))
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
            paths: Array.from(elements, id => this.GetPath(id))
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
            const clipboard = await navigator.clipboard.readText();

            return JSON.parse(clipboard) as MoveElements;
        } catch (error) {
            return undefined;
        }
    }

    public OpenFile(id: number, onCreate = false) {
        this.OnFileClick(id, onCreate);
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

    protected override async OnFileClick(id: number, onCreate = false) {
        this.fileController?.abort();
        this.fileController = new AbortController();

        const signal = this.fileController.signal;

        const file = this.GetElement(id);
        const originalFile = this.GetElement(this.opened_file);

        if (!file) return;
        if (this.storage.get_open(id)) return;

        if (originalFile) {
            this.storage.set_open(this.opened_file, false);

            if (originalFile.element) {
                originalFile.element.style.backgroundColor = "";
            }
        }

        this.opened_file = id;
        const filePath = document.getElementById("file-path");

        if (filePath) {
            const parts = this.GetPath(id).split(/[\\/]/).filter(Boolean);
            const folder = this.path.split(/[\\/]/).filter(Boolean).pop();

            const pathIndex = parts.indexOf(folder!);
            const displayPath = pathIndex !== -1 ? "../" + parts.slice(pathIndex).join("/") : parts.pop() ?? "";

            filePath.textContent = displayPath;
        }

        if (file.element) {
            file.element.style.backgroundColor = "rgba(75, 85, 99, 0.15)";
        }

        this.storage.set_open(id, true);
        this.editor.ResetEditor();

        if (onCreate) {
            await this.editor.NewRender();
            return;
        }

        const content = this.storage.get_content(id);

        if (content === undefined) {
            const path = this.GetPath(id);
            const predenting: Package[] = [];

            let lastPosition = 0;
            let lastIndex = 0;
            let processing = false;
            let rendered = false;
            let firstLoad = true;

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
                let value = 0;

                if (firstLoad) {
                    const charWidth = 7.697265625;
                    const lineHeight = 21;
                    const columns = Math.floor(screen.width / charWidth);
                    const rows = Math.floor(screen.height / lineHeight);

                    value = columns * rows;
                }

                const pack = await this.api.ReadFile(
                    path,
                    lastPosition,
                    firstLoad ? value : 256 * 1024
                );

                if (firstLoad && pack.text.length === 0 && pack.end) {
                    await this.editor.NewRender();
                    this.storage.set_content(id, "");
                    return;
                }

                if (signal.aborted) return;

                if (pack.text.length > 0) {
                    predenting.push(pack);
                    void processQueue();
                }

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

        await this.editor.Insert(content);

        if (signal.aborted) return;

        await this.editor.NewRender();
    }

    private scrollSpacer!: HTMLDivElement;

    private InitScrollHeight(): void {
        if (this.scrollSpacer) return;

        this.scrollSpacer = document.createElement("div");
        this.scrollSpacer.style.height = "0px";
        this.scrollSpacer.style.width = "1px";
        this.scrollSpacer.style.pointerEvents = "none";

        this.tree.appendChild(this.scrollSpacer);
    }

    private UpdateScrollHeight(): void {
        const rowHeight = 26;

        this.scrollSpacer.style.height = `${this.storage.len() * rowHeight}px`;
    }

    private GetElementRow(element: FileEntry): HTMLElement | null {
        if (element.id === undefined) return null;

        return this.dom.GetDOM(element.id)?.row ?? null;
    }

    private SortElements(parentId: number): number[] {
        return Array.from(this.storage.get_children(parentId)).sort((a, b) => {
            const elementA = this.GetElement(a);
            const elementB = this.GetElement(b);

            if (!elementA || !elementB) return 0;

            const folderOrder = Number(elementB.kind === "Directory") - Number(elementA.kind === "Directory");

            return folderOrder || elementA.name.localeCompare(elementB.name);
        });
    }

    public QueueScan(path: string, limit: number, parentId: number): void {
        const dir = this.GetElement(parentId);

        if (!dir || dir.kind !== "Directory") return;

        if (dir.loaded) {
            this.dom.RenderChildren(parentId, this.SortElements(parentId));
            return;
        }

        void this.ScanDirectory(path, parentId);
    }

    private async ScanDirectory(path: string, parentId: number): Promise<void> {
        this.InitScrollHeight();
        
        void this.api.OpenDirectory(path, null).then(entries => {
            if (!entries) return;

            console.log(`scanning: ${path} | Entries: ${entries}`);
            this.ManageElements(path, parentId, entries);
            this.UpdateScrollHeight();
        }).catch(console.error);
    }

    private ManageElements(path: string, parentId: number, entries: RustFileEntry[]): void {
        const parent = this.GetElement(parentId);

        if (!parent || parent.kind !== "Directory") return;

        for (const entry of entries) {
            const kind = entry.kind === "File" ? 0 : entry.kind === "Directory" ? 1 : 2;
            this.storage.add_element(entry.name, kind, parentId);
        }

        this.storage.set_loaded(parentId, true);

        const sortedElements = this.SortElements(parentId);
        this.dom.RenderChildren(parentId, sortedElements.slice(0, 50));
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

    public UpdateExplorer(): void {
        const tree = document.getElementById("tree");

        if (!tree) {
            console.error('Element "#tree" not found');
            return;
        }

        const ids = this.storage.get_all_ids();

        for (const id of ids) {
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
            is_open: this.storage.get_open(id),
            loaded: this.storage.get_loaded(id),
        };
    }

    public GetPath(id: number): string {
        const entry = this.GetElement(id);

        if (!entry) {
            throw new Error(`Element with ID ${id} was not found`);
        }

        if (entry.parent === null) {
            return this.path;
        }

        return `${this.GetPath(entry.parent)}\\${entry.name}`;
    }
}


export class TabModel {
    private selectedFileId: number | null = null;
    private openFileIds: number[] = [];
    private dom: DomUpdate;
    private explorer: ExplorerModel;
    private editor!: EditorModel;

    constructor(dom: DomUpdate, explorer: ExplorerModel) {
        this.dom = dom;
        this.explorer = explorer;

        
        this.bindTabEvents();
    }

    public SetEditor(editor: EditorModel) {
        this.editor = editor;
    }
    
    public OpenTab(fileId: number): void {
        if (!this.IsOpen(fileId)) {
            this.openFileIds.push(fileId);
        }

        this.selectedFileId = fileId;
        this.dom.RenderTabs(this, this.explorer);
    }

    public IsSelected(fileId: number): boolean { return this.selectedFileId === fileId; }
    public IsOpen(fileId: number): boolean { return this.openFileIds.includes(fileId); }
    public GetOpenFileIds(): readonly number[] { return this.openFileIds; }
    public GetSelectedFileId(): number | null { return this.selectedFileId; }

        
    private bindTabEvents(): void {
        const filesExplorer = document.querySelector<HTMLElement>(".file_pos");

        if (!filesExplorer) {
            console.error(".file_pos not found");
            return;
        }

        filesExplorer.addEventListener("pointerover", this.handleTabPointerOver);
        filesExplorer.addEventListener("pointerout", this.handleTabPointerOut);
        filesExplorer.addEventListener("click", this.handleTabClick);
    }

    private readonly handleTabPointerOver = (event: PointerEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const tab = target.closest<HTMLElement>(".explorer_file");
        if (!tab) return;

        if (event.relatedTarget instanceof Node && tab.contains(event.relatedTarget)) {
        return;
        }

        tab.style.backgroundColor = "#202020";
    };

    private readonly handleTabPointerOut = (event: PointerEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const tab = target.closest<HTMLElement>(".explorer_file");
        if (!tab) return;

        if (event.relatedTarget instanceof Node && tab.contains(event.relatedTarget)) { return; }
    
        tab.style.backgroundColor = "";
    };

    private readonly handleTabClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const tab = target.closest<HTMLElement>(".explorer_file");
        if (!tab) return;

        const id = Number(tab.dataset.id);
        if (!Number.isFinite(id)) return;

        const entry = this.explorer.GetElement(id);
        if (!entry) return;

        const close = target.closest<HTMLElement>(".exit");

        if (close) {
            event.stopPropagation();
            // void this.dom.ShowMessage(id);
            return;
        }

        const previousTab = document.querySelector<HTMLElement>(".explorer_file.selected_file");

        if (previousTab && previousTab !== tab) {
            previousTab.classList.remove("selected_file");
            previousTab.style.backgroundColor = "";
        }

        tab.classList.add("selected_file");
        tab.style.backgroundColor = "#202020";

        requestAnimationFrame(() => {
            this.explorer.OpenFile(id);
        });
    };
}

async function main(): Promise<void> {
    const tree = document.getElementById("tree");

    if (!tree) {
        throw new Error('Element "#tree" not found');
    }

    const storage = await InitializeCore();
    const model = new ExplorerModel(tree, Path, storage);
    const view = new DomUpdate(model);
    const tab = new TabModel(view, model);
    const editor = new EditorModel();

    model.SetView(view);
    model.SetTab(tab);

    await editor.init();

    model.SetEditor(editor);
    tab.SetEditor(editor);

    (window as any).editorModel = editor;

    model.addProject(Path, { 
        name: "BatataIDE",
        kind: "Directory",
        parent: null,
        is_open: false,
    });

    model.UpdateExplorer();
}

main();