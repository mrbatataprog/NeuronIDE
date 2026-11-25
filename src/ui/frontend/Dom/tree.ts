import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BackendAPI } from "../backend";
import { FileEntry, FileType, MenuModel, TabInfo } from "../explorer";
import { FileManager } from "../explorer";
import { ExplorerModel } from "../explorer";
import { ListenToOptions } from "../../public/packages/options/options";
import { ListenToMenu } from "../../public/packages/menu/menu";
import { FileEntryDOM } from "../explorer";

import { FetchAsset } from "../../assets";

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
        
        icon.src = entry.parent === null ? "./icons/menu/project_folder.svg" : this.GetFolderIcon(entry.name);
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
            // title.textContent = `~/${(entry.path ?? "").split(/[\\/]/)[3] ?? ""}`; // Just temperaly removed.
            title.className = "purple_btn";

            name.appendChild(dot);
            name.appendChild(document.createTextNode(" "));
            name.appendChild(title);
        } else {
            name.textContent = entry.name;
        }

        actions.className = "tree-actions";

        AddFileIcon.src = "/icons/menu/new_file.svg";
        AddfolderIcon.src = "/icons/menu/add_folder.svg";
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
    
    public UnrenderChild(childId: number): void {
        const entry = this.domElements.get(childId);
        if (!entry) return;

        entry.element.remove();
        this.domElements.delete(childId);
    }

    public RenderChildren(parentId: number, children: number[]): void {
        console.log(`Rendering: ${children.length}`);
        for (const childId of children) {
            this.RenderChild(childId, parentId);
        }
    }

    
    public RenderChild(childId: number | undefined, parentId: number | null, render = true) {
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

        if (element.parentElement === container) return element;
        if (render) { container.appendChild(element); }

        return element;
    }
    
 
    public RenderAllChildren(parentId: number, children: DocumentFragment, appened: "Up" | "Down") {
        const container = this.GetChildren(parentId);
        if (!container) return;

        container.style.display = "block";

        console.log(appened);
        if (appened === "Down") { container.appendChild(children); return; }
        if (appened === "Up") { container.prepend(children); return }
    }

    public HideChildren(parentId: number): void {
        const parentElement = document.querySelector<HTMLElement>(`.folder[data-id="${parentId}"]`);
        const container = parentElement?.querySelector<HTMLElement>(":scope > .folder-children");

        if (container) {
            container.style.display = "none";
        }
    }

    public RenderTabs(entries: TabInfo[], selected: number, onSelected: (element: HTMLElement) => void): void {
        const filesExplorer = document.querySelector<HTMLElement>(".file_pos");
        if (!filesExplorer) return;

        filesExplorer.replaceChildren();

        for (const entry of entries) {
            const tab = document.createElement("div");
            const icon = document.createElement("img");
            const close = document.createElement("img");
            const name = document.createElement("span");
            tab.className = "explorer_file";
            tab.dataset.id = entry.id.toString();


            icon.src = this.GetFileIcon(entry.name);
            icon.alt = "";

            name.textContent = entry.name;

            close.src = "/icons/close_file.svg";
            close.className = "exit";
            close.alt = "";
            close.dataset.action = "close-tab";

            tab.append(icon, name, close);

            if (selected === entry.id) {
                tab.classList.add("selected_file");
                onSelected(tab);
            }

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

        const response = await FetchAsset("/packages/options/options.html");

        if (!response.ok) {
            throw new Error(`Failed to load options.html: ${response.status}`);
        }

        container.innerHTML = await response.text();

        const entry = this.model.GetElement(id);
        const popup = document.getElementById("file-popup");

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

    public async ShowWarning(cancle: () => void, deleteElement: () => void) {
        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        const response = await FetchAsset("/packages/message/delete_warning.html");

        if (!response.ok) {
            throw new Error(`Failed to load error.html: ${response.status}`);
        }

        container.insertAdjacentHTML("beforeend", await response.text());

        const popup = document.getElementById("warning-popup");
        const background = document.getElementById("warning-background");

        if (!popup) throw new Error("Warning popup not found");
        if (!background) throw new Error("Warning background popup not found");
    
        popup.addEventListener("mousedown", (event: MouseEvent) => {
            event.stopPropagation();

            const target = event.target as HTMLElement;
            const button = target.closest(".save_btn") as HTMLElement | null;

            if (!button) return;

            switch (button.id) {
                case "cancel": popup.remove(); background.remove(); cancle(); break;
                case "delete": deleteElement(); popup.remove(); background.remove(); break;
            }
        });
    }

    public async ShowError(x: number, y: number): Promise<HTMLElement> {
        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        const response = await FetchAsset("/packages/error/error.html");

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

    public async ShowMenu(x: number, y: number, model: MenuModel, setPopup: (element: HTMLElement) => void, setSize: (size: number) => void, onExit: () => void): Promise<void> {
        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        const response = await FetchAsset("packages/menu/menu.html");
        const html = await response.text();
        container.innerHTML = html;

        const popup = document.getElementById("menu-popup");

        if (!popup) throw new Error("Menu popup not found");

        setSize(popup.getBoundingClientRect().width ?? 0);

        popup.style.position = "fixed";
        popup.style.left = `${x + 2}px`;
        popup.style.top = `${y + 5}px`;

        setPopup(popup);
        ListenToMenu(model, popup, onExit, onExit);
    }

    public async ShowRecent(x: number, y: number, width: number): Promise<HTMLElement> {
        const popup = document.createElement("div");
        popup.className = "popup recent";
        popup.id = "recent";

        console.log(x + width);
        popup.style.left = `${x + width + 5}px`;
        popup.style.top = `${y}px`;

        document.body.appendChild(popup);
        return popup;
    }

    public async AddRecent(ui: HTMLElement, path: string, text: string, separate: boolean) {
        const selection = document.createElement("div");
        const icon = document.createElement("img");        
        const label = document.createElement("span");
        const time = document.createElement("div");
        const options = document.createElement("img");

        selection.className = "selection";
        selection.dataset.path = path;

        icon.className = "selection-icon";
        icon.src = "./icons/menu/project_folder.svg";

        label.className = "selection-text";
        label.textContent = path || text;

        time.className = "selection-shortcut";
        time.textContent = text;

        options.className = "selection-shortcut-icon";
        options.src = "./icons/dots.svg";
        options.dataset.type = "more";
        options.dataset.path = path;

        selection.appendChild(icon);
        selection.appendChild(label);        
        selection.appendChild(time);
        selection.appendChild(options);

        ui.appendChild(selection);

        if (separate) {
            const separator = document.createElement("div");
            separator.className = "separator";
            ui.appendChild(separator);
        }
    }

    public RemoveRecent(element: HTMLElement | null): void {
        if (!element) return;

        const previous = element.previousElementSibling;

        if (previous?.classList.contains("separator")) {
            previous.remove();
        }

        element.remove();
    }

    public async ShowMore_Recent(path: string, width: number, x: number, y: number) {
        const response = await FetchAsset("packages/menu/more.html");
        const html = await response.text();

        let container = document.getElementById("message-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "message-container";
            document.body.appendChild(container);
        }

        container.insertAdjacentHTML("beforeend", html);

        const popup = document.getElementById("more_recent");

        if (!popup) return null;

        popup.style.left = `${x + width + 6}px`;
        popup.style.top = `${y - 10}px`;


        return popup;
    }

    
    public ResetDom(): void {
        this.CloseCreateUI();

        for (const { element } of this.domElements.values()) {
            element.remove();
        }

        this.domElements.clear();

        document.getElementById("message-container")?.replaceChildren();
    }
}
