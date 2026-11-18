import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BackendAPI } from "../backend";
import { FileEntry, FileType } from "../explorer";
import { FileManager } from "../explorer";
import { ExplorerModel } from "../explorer";
import { ListenToOptions } from "../../packages/options/options";
import { ListenToMessage } from "../../packages/message/message";
import { TabModel } from "../explorer";
import { FileEntryDOM } from "../explorer";
import { EventOptions } from "../explorer";
export class DomUpdate {
    private model: ExplorerModel;
    private domElements = new Map<number, FileEntryDOM & { element: HTMLElement }>();

    public GetDOM(id: number): (FileEntryDOM & { element: HTMLElement }) | undefined {
        return this.domElements.get(id);
    }

    constructor(model: ExplorerModel) {
        this.model = model;
    }

    public GetFileIcon(fileName: string): string {
        const dotIndex = fileName.lastIndexOf(".");
        const extension = fileName.slice(dotIndex + 1).toLowerCase();

        if (dotIndex === -1 || dotIndex === fileName.length - 1) {
            return "/icons/languages/default.svg";
        }

        return `/icons/languages/${extension}.svg`;
    }

    public GetFolderIcon(folderName: string): string {
        return `/icons/folders/open/${folderName.toLowerCase()}.svg`;
    }

    public AddFolder(entry: FileEntry): HTMLElement {
        const folder = document.createElement("div");
        const row = document.createElement("div");
        const icon = document.createElement("img");
        const stateIcon = document.createElement("img");
        const name = document.createElement("span");
        const children = document.createElement("div");

        const actions = document.createElement("div");        
        const AddFileIcon = document.createElement("img");
        const AddfolderIcon = document.createElement("img");
        const SearchIcon = document.createElement("img");
        const CloseIcon = document.createElement("img");
        
        const id = entry.id ?? 0;
    
        name.className = "tree-entry-name";

        folder.className = "folder file";
        folder.dataset.name = entry.name;
        folder.dataset.id = id.toString();

        stateIcon.className = "folder-toggle-icon";
        stateIcon.dataset.id = id.toString();
        stateIcon.dataset.action = "toggle-folder";
        stateIcon.src = "/icons/closed_folder.svg";
        stateIcon.alt = "";
        
        icon.src = entry.parent === null ? "./icons/project_folder.svg" : this.GetFolderIcon(entry.name);
        icon.alt = "";

        row.className = "tree-folder-row";

        icon.onerror = () => {
            icon.onerror = null;
            icon.src = this.GetFolderIcon("default");
        };

        if (entry.parent === null) {
            const title = document.createElement("span");
            const dot = document.createElement("span");

            dot.textContent = "•";

            name.textContent = entry.name + " ";
            title.textContent = "~/Test"; // Hardcoded just for now.
            title.className = "purple_btn";

            name.appendChild(dot);
            name.appendChild(document.createTextNode(" "));
            name.appendChild(title);
        } else {
            name.textContent = entry.name;
        }

        actions.className = "tree-actions";

        AddFileIcon.src = "/icons/new_file.svg";
        AddfolderIcon.src = "/icons/folder.svg";
        SearchIcon.src = "/icons/top_search.svg";
        CloseIcon.src = "/icons/close.svg";

        AddFileIcon.dataset.action = "new-file";
        AddfolderIcon.dataset.action = "new-folder";
        SearchIcon.dataset.action = "search";
        CloseIcon.dataset.action = "close";

        AddFileIcon.dataset.parentId = String(entry.id);
        AddfolderIcon.dataset.parentId = String(entry.id);
        SearchIcon.dataset.parentId = String(entry.id);
        CloseIcon.dataset.parentId = String(entry.id);
        actions.append(AddfolderIcon, AddFileIcon, SearchIcon, CloseIcon);

        const content = document.createElement("div");
        content.className = "tree-folder-content";

        content.append(icon, name);

        row.appendChild(stateIcon);
        row.appendChild(content);
        row.appendChild(actions);

        children.className = "folder-children";

        folder.appendChild(row);
        folder.appendChild(children);


        entry.toggleElement = stateIcon;
        entry.element = folder;
        this.domElements.set(id, {
            element: folder,
            row,
            name,
            icon,
            actions,
            children,
            toggle: stateIcon,
        });

        return folder;
    }

    public AddFile(entry: FileEntry): HTMLElement {
        const file = document.createElement("div");
        const id = entry.id ?? 0;

        file.className = "tree-file file";
        file.dataset.id = id.toString();

        const icon = document.createElement("img");
        icon.src = this.GetFileIcon(entry.name);
        icon.alt = "";

        icon.onerror = () => {
            icon.onerror = null;
            icon.src = this.GetFileIcon("default");
        };
        
        const name = document.createElement("span");
        name.textContent = entry.name;

        const content = document.createElement("div");
        content.className = "tree-file-content";

        content.append(icon, name);
        file.appendChild(content);

        entry.element = file;
        this.domElements.set(id, {
            element: file,
            row: file,
            name,
            icon,
        });

        return file;
    }

    public GetChildren(folderId: number): HTMLElement | null {
        return this.domElements.get(folderId)?.children ?? null;
    }

    private closeCreateUI: (() => void) | null = null;
    public CloseCreateUI(): void {
        this.closeCreateUI?.();
        this.closeCreateUI = null;
    }

    public CreateEntry(dom: FileEntryDOM, kind: FileType, isRename: boolean, register: () => void, compare: () => boolean, exit: () => void): void {
        this.CloseCreateUI();

        const input = dom.input;
        const icon = dom.icon;
        const row = dom.row;

        let errorElement: HTMLElement | null = null;

        const controller = new AbortController();
        const { signal } = controller;

        let closed = false

        if (!input) return;
                
        const success = async (): Promise<void> => {
            if (closed) return;

            closed = true;
            controller.abort();

            if (this.closeCreateUI === close) {
                this.closeCreateUI = null;
            }

            errorElement?.remove();

            if (isRename) {
                await register();
                dom.name.textContent = dom.input?.value.trim() ?? "";
                dom.input?.replaceWith(dom.name);
            } else {
                dom.row.remove();
                register();
            }
        };

        const close = (): void => {
            if (closed) return;

            closed = true;
            controller.abort();

            if (this.closeCreateUI === close) {
                this.closeCreateUI = null;
            }

            if (isRename) {
                dom.input?.replaceWith(dom.name);
            } else {
                dom.row.remove();
            }

            errorElement?.remove();
            exit();
        };

        this.closeCreateUI = close;
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter") { event.preventDefault(); success(); return; }
            if (event.key === "Escape") { event.preventDefault(); close(); return; }
        }, { signal });

        input.addEventListener("input", () => {
            icon.src = kind === "Directory" ? this.GetFolderIcon(input.value.trim()) : this.GetFileIcon(input.value.trim());
            icon.onerror = () => {
                icon.onerror = null;
                icon.src = kind === "Directory" ? this.GetFolderIcon("default") : this.GetFileIcon("default");
            };

            if (compare()) {
                input.style.borderColor = "red";

                const rect = row.getBoundingClientRect();

                errorElement?.remove();
                void this.ShowError(rect.right + 10, rect.top).then(element => { errorElement = element; });
                return;
            }

            input.style.borderColor = "#007fd4";

            errorElement?.remove();
            errorElement = null;

            input.style.borderColor = "#007fd4";
        }, { signal });

        document.addEventListener("pointerdown", (event: PointerEvent) => {
            if (!(event.target instanceof Node)) return;

            if (row.contains(event.target)) return;
            if (errorElement?.contains(event.target)) return;

            close();
        }, { signal, capture: true });

        setTimeout(() => {
            if (!closed) {
                document.addEventListener("mousedown", (event) => {
                    if (event.target instanceof Node && !row.contains(event.target)) { exit(); }
                }, { signal });
            }
        }, 0);

        input.focus();
    }

    public MakeFolder(folderId: number): FileEntryDOM | null {
        const children = this.GetChildren(folderId);
        if (!children) return null;

        const row = document.createElement("div");
        const toggle = document.createElement("img");
        const icon = document.createElement("img");
        const input = document.createElement("input");
        const name = document.createElement("span");

        row.className = "new-folder-row";

        toggle.className = "folder-toggle-icon";
        toggle.src = "/icons/closed_folder.svg";
        toggle.alt = "Toggle folder";

        icon.src = "/icons/folders/open/default.svg";
        icon.alt = "New folder";

        input.className = "new-folder-input";
        input.placeholder = "Folder name";
        input.type = "text";

        name.className = "tree-entry-name";

        row.append(toggle, icon, input);
        children.prepend(row);

        input.focus();

        return { element: row, row, name, icon, input, toggle };
    }

    public MakeFile(folderId: number): FileEntryDOM | null {
        const children = this.GetChildren(folderId);
        if (!children) return null;

        const row = document.createElement("div");
        const icon = document.createElement("img");
        const input = document.createElement("input");
        const name = document.createElement("span");

        row.className = "new-file-row";

        icon.src = "/icons/languages/default.svg";
        icon.alt = "New file";

        input.className = "new-file-input";
        input.placeholder = "File name";
        input.type = "text";

        name.className = "tree-entry-name";

        row.append(icon, input);
        children.prepend(row);

        input.focus();

        return { element: row, row, name, icon, input };
    }

    public MakeRename(id: number): FileEntryDOM | null {
        const entry = this.model.GetElement(id);
        const dom = this.domElements.get(id);

        if (!entry || !dom) return null;
        if (entry.parent === null) return null;
        if (!dom.name.isConnected) return null;

        const input = document.createElement("input");

        input.type = "text";
        input.className = "rename-input";
        input.value = entry.name;

        dom.name.replaceWith(input);

        input.focus();
        input.select();

        return { ...dom, input };
    }

    public Render(entry: FileEntry, tree: HTMLElement): void {
        const id = entry.id;
        if (id === undefined || this.domElements.has(id)) return;

        if (entry.kind !== "Directory") return;

        const folder = this.AddFolder(entry);

        if (entry.parent === null) {
            tree.appendChild(folder);
            return;
        }

        const parentDOM = this.domElements.get(entry.parent);

        if (parentDOM?.children) {
            parentDOM.children.appendChild(folder);
        }
    }

    public UnrenderChildren(parentId: number): void {
        const children = this.GetChildren(parentId);

        if (!children) return;

        children.style.display = "none";
    }

    public RenderChildren(parentId: number, children: number[]): void {
        for (const childId of children) {
            this.RenderChild(childId, parentId);
        }
    }

    public RenderChild(childId: number | undefined, parentId: number | null): void {
        if (childId === undefined || parentId === null) return;

        const container = this.GetChildren(parentId);
        if (!container) return;

        container.style.display = "block";

        const child = this.model.GetElement(childId);
        if (!child) return;

        let element = this.domElements.get(childId)?.element;

        if (!element) {
            switch (child.kind) {
                case "Directory": element = this.AddFolder(child); break;
                case "File": element = this.AddFile(child); break;
                default: return;
            }
        }

        container.appendChild(element);
    }

    public HideChildren(parentId: number): void {
        const parentElement = document.querySelector<HTMLElement>(`.folder[data-id="${parentId}"]`);
        const container = parentElement?.querySelector<HTMLElement>(":scope > .folder-children");

        if (container) {
            container.style.display = "none";
        }
    }

    public RenderTabs(tabModel: TabModel, explorerModel: ExplorerModel): void {
        const filesExplorer = document.querySelector<HTMLElement>(".file_pos");
        if (!filesExplorer) return;

        filesExplorer.replaceChildren();

        for (const fileId of tabModel.GetOpenFileIds()) {
            const entry = explorerModel.GetElement(fileId);
            if (!entry) continue;
            if (!entry.id) continue;
 
            const tab = document.createElement("div");
            const icon = document.createElement("img");
            const close = document.createElement("img");
            const name = document.createElement("span");
            tab.className = "explorer_file";
            tab.dataset.id = entry.id.toString();

            if (tabModel.IsSelected(fileId)) {
                tab.classList.add("selected_file");
            }

            icon.src = this.GetFileIcon(entry.name);
            icon.alt = "";

            name.textContent = entry.name;

            close.src = "/icons/close_file.svg";
            close.className = "exit";
            close.alt = "";
            close.dataset.action = "close-tab";

            tab.append(icon, name, close);
            filesExplorer.appendChild(tab);
        }
    }

    public async ShowMessage(id: number, x: number, y: number, onExit: () => void): Promise<void> {
        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        const response = await fetch("/packages/options/options.html");

        if (!response.ok) {
            throw new Error(`Failed to load options.html: ${response.status}`);
        }

        container.innerHTML = await response.text();

        const entry = this.model.GetElement(id);
        const popup = container.querySelector<HTMLElement>(".file-popup");

        if (!entry) throw new Error(`Entry ${id} not found`);
        if (!popup) throw new Error("File popup not found");

        popup.style.position = "fixed";
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;

        const closePopup = (): void => {
            popup.remove();
        };

        ListenToOptions(entry, this.model, popup, closePopup, onExit);
    }

    public async ShowError(x: number, y: number): Promise<HTMLElement> {
        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        const response = await fetch("/packages/error/error.html");

        if (!response.ok) {
            throw new Error(`Failed to load error.html: ${response.status}`);
        }

        container.innerHTML = await response.text();

        const message = container.querySelector<HTMLElement>(".explorer_error_message");

        if (!message) throw new Error("Error message not found");

        message.style.position = "fixed";
        message.style.left = `${x}px`;
        message.style.top = `${y}px`;
        
        return message;
    }
}
