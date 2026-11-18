import { FileEntry, FileManager } from "../../frontend/explorer";

export function ListenToOptions(entry: FileEntry, file: FileManager, popup: HTMLElement, closePopup: () => void, onExit: () => void): () => void {
    const cut = popup.querySelector<HTMLElement>("#cut");
    const copy = popup.querySelector<HTMLElement>("#copy");
    const paste = popup.querySelector<HTMLElement>("#paste");
    const newFile = popup.querySelector<HTMLElement>("#new-file");
    const newFolder = popup.querySelector<HTMLElement>("#new-folder");
    const openExplorer = popup.querySelector<HTMLElement>("#explorer");
    const deleteElement = popup.querySelector<HTMLElement>("#delete");
    const renameElement = popup.querySelector<HTMLElement>("#rename");

    if (!cut) throw new Error("#cut element not found");
    if (!copy) throw new Error("#copy element not found");
    if (!paste) throw new Error("#paste element not found");
    if (!newFile) throw new Error("#new-file element not found");
    if (!newFolder) throw new Error("new-folder element not found");
    if (!openExplorer) throw new Error("explorer element not found");
    if (!deleteElement) throw new Error("deleteElement element not found");
    if (!renameElement) throw new Error("renameElement element not found");

    let unlistened = false;
    let processingPaste = false;

    const exit = (): void => {
        if (unlistened) return;

        cleanup();
        closePopup();
        onExit();
    };

    const CheckPasted = async (): Promise<void> => {
        if (file.getSelectedElements().length > 1) { paste.style.opacity = "0.6"; file.pasteAvaiable(false); return; }
        if (await file.HandleSubFolder(entry.id)) { paste.style.opacity = "0.6"; file.pasteAvaiable(false); return; }
        if (!(await file.getMoved())) { paste.style.opacity = "0.6"; file.pasteAvaiable(false); return; }


        paste.style.opacity = "1";

        file.pasteAvaiable(true);
    };

    const handleCutClick = async (): Promise<void> => {
        if (unlistened) return;
        
        file.HandleCut();
        exit();
    };

    const handleCopyClick = async (): Promise<void> => {
        if (unlistened) return;
        
        file.HandleCopy();
        exit();
    };

    const handlePasteClick = async (): Promise<void> => {
        if (unlistened || processingPaste) return;
        if (!file.pasteAvaiable()) { return; }

        file.HandlePaste(entry.id ?? 0);
        exit();
    };
    
    const handleNewFile = async(): Promise<void> => {
        if (unlistened) return;
        file.HandleCreateFile(entry.id ?? 0);
        exit();
    }

    const handleNewFolder = async (): Promise<void> => {
        if (unlistened) return;

        file.HandleCreateFolder(entry.id ?? 0);
        exit();
    }

    const handleExplorer = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleExplorerOpen(entry.id ?? 0);
        exit();
    }

    const handleDelete = async (): Promise<void> => {
        if (unlistened) return;

        file.HandleDelete();
        exit();
    };

    const handleReName = async (): Promise<void> => {
        if (unlistened) return;

        file.HandleRename(entry.id ?? 0);
        exit();
    }

    const handleOutsideClick = (event: MouseEvent): void => {
        if (unlistened) return;

        if (!popup.contains(event.target as Node)) {
            exit();
        }
    };

    const handleEscape = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            exit();
        }
    };

    const cleanup = (): void => {
        if (unlistened) return;
        unlistened = true;

        cut.removeEventListener("click", handleCutClick);
        copy.removeEventListener("click", handleCopyClick);
        paste.removeEventListener("click", handlePasteClick);
        newFile.removeEventListener("click", handleNewFile);
        newFolder.removeEventListener("click", handleNewFolder);
        openExplorer.removeEventListener("click", handleExplorer);
        deleteElement.removeEventListener("click", handleDelete);
        renameElement.removeEventListener("click", handleReName);
        document.removeEventListener("click", handleOutsideClick);
        document.removeEventListener("keydown", handleEscape);
    };

    void CheckPasted();

    cut.addEventListener("click", handleCutClick);
    copy.addEventListener("click", handleCopyClick);
    paste.addEventListener("click", handlePasteClick);
    newFile.addEventListener("click", handleNewFile);
    newFolder.addEventListener("click", handleNewFolder);
    openExplorer.addEventListener("click", handleExplorer);
    deleteElement.addEventListener("click", handleDelete);
    renameElement.addEventListener("click", handleReName);

    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return cleanup;
}