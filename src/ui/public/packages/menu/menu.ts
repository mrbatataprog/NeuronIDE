import { MenuModel } from "../../../frontend/explorer";

export function ListenToMenu(file: MenuModel, popup: HTMLElement, closePopup: () => void, onExit: () => void): () => void {
    const openFile = popup.querySelector<HTMLElement>("#open-file");
    const openFolder = popup.querySelector<HTMLElement>("#open-folder");
    const newFile = popup.querySelector<HTMLElement>("#new-file");
    const newFolder = popup.querySelector<HTMLElement>("#new-folder");
    const openRecent = popup.querySelector<HTMLElement>("#open-recent");
    const newWindow = popup.querySelector<HTMLElement>("#new-window");
    const newWorkspace = popup.querySelector<HTMLElement>("#new-workspace");
    const duplicateWorkspace = popup.querySelector<HTMLElement>("#duplicate");
    const save = popup.querySelector<HTMLElement>("#save");
    const saveAll = popup.querySelector<HTMLElement>("#save-all");
    const saveAs = popup.querySelector<HTMLElement>("#save-as");
    const gitCommit = popup.querySelector<HTMLElement>("#git-commit");
    const closeFolder = popup.querySelector<HTMLElement>("#close-folder");
    const saveExit = popup.querySelector<HTMLElement>("#save-exit");
    const exitElement = popup.querySelector<HTMLElement>("#exit");

    if (!openFile) throw new Error("#open_file element not found");
    if (!openFolder) throw new Error("#open_folder element not found");
    if (!newFile) throw new Error("#new-file element not found");
    if (!openRecent) throw new Error("#open-recent element not found");
    if (!newWindow) throw new Error("#new-window element not found");
    if (!newWorkspace) throw new Error("#new-workspace element not found");
    if (!duplicateWorkspace) throw new Error("#new-workspace element not found");
    if (!save) throw new Error("#save element not found");
    if (!saveAll) throw new Error("#save-all element not found");
    if (!saveAs) throw new Error("#save-as element not found");
    if (!gitCommit) throw new Error("#git-commit element not found");
    if (!closeFolder) throw new Error("#close-folder element not found");
    if (!saveExit) throw new Error("#save-exit element not found");
    if (!exitElement) throw new Error("#exit element not found");

    let unlistened = false;

    const exit = (): void => {
        if (unlistened) return;

        cleanup();
        closePopup();
        onExit();
    };

    const handleOpenFile = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleOpenFile();
        exit();
    };

    const handleOpenFolder = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleOpenFolder();
        exit();
    };

    const handleNewFile = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleNewFile();
        exit();
    };

    const handleOpenRecent = async (): Promise<void> => {
        if (unlistened) return;

        const rect = openRecent.getBoundingClientRect();

        const x = rect.left;
        const y = rect.top;

        file.HandleRecent(x, y);
    };

    const handleNewWindow = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleNewWindow();
        exit();
    };

    const handleDuplicatedWorkspace = async (): Promise<void> => {
        if (unlistened) return; 
    }

    const handleNewWorkspace = async (): Promise<void> => {
        if (unlistened) return;
    };

    const handleSave = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleSave();
        exit();
    };

    const handleSaveAll = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleSaveAll();
        exit();
    };

    const handleSaveAs = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleSaveAs();
        exit();
    };

    const handleGitCommit = async (): Promise<void> => {
        if (unlistened) return;
    };

    const handleCloseFolder = async (): Promise<void> => {
        if (unlistened) return;
        exit();
    };

    const handleSaveExit = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleExit(true);
        exit();
    };

    const handleExit = async (): Promise<void> => {
        if (unlistened) return;
        file.HandleExit(true);
        exit();
    };

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

        openFile.removeEventListener("click", handleOpenFile);
        openFolder.removeEventListener("click", handleOpenFolder);
        newFile.removeEventListener("click", handleNewFile);
        openRecent.removeEventListener("click", handleOpenRecent);
        newWindow.removeEventListener("click", handleNewWindow);
        newWorkspace.removeEventListener("click", handleNewWorkspace);
        duplicateWorkspace.removeEventListener("click", handleDuplicatedWorkspace);
        save.removeEventListener("click", handleSave);
        saveAll.removeEventListener("click", handleSaveAll);
        saveAs.removeEventListener("click", handleSaveAs);
        gitCommit.removeEventListener("click", handleGitCommit);
        closeFolder.removeEventListener("click", handleCloseFolder);
        saveExit.removeEventListener("click", handleSaveExit);
        exitElement.removeEventListener("click", handleExit);

        document.removeEventListener("mousedown", handleOutsideClick);
        document.removeEventListener("keydown", handleEscape);
    };

    openFile.addEventListener("click", handleOpenFile);
    openFolder.addEventListener("click", handleOpenFolder);
    newFile.addEventListener("click", handleNewFile);
    openRecent.addEventListener("click", handleOpenRecent);
    newWindow.addEventListener("click", handleNewWindow);
    newWorkspace.addEventListener("click", handleNewWorkspace);
    duplicateWorkspace.addEventListener("click", handleDuplicatedWorkspace);
    save.addEventListener("click", handleSave);
    saveAll.addEventListener("click", handleSaveAll);
    saveAs.addEventListener("click", handleSaveAs);
    gitCommit.addEventListener("click", handleGitCommit);
    closeFolder.addEventListener("click", handleCloseFolder);
    saveExit.addEventListener("click", handleSaveExit);
    exitElement.addEventListener("click", handleExit);

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return cleanup;
}
