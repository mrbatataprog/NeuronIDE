import { FileManager } from "../../frontend/explorer";

function closePopup(dialog: HTMLElement, background: HTMLElement | null): void {
    dialog.classList.add("closing");
    background?.classList.add("closing");

    dialog.addEventListener("animationend", () => {
        dialog.remove();
        background?.remove();
    }, { once: true });
}


export function ListenToMessage(file: FileManager, id: number): void {
    const dialog = document.querySelector<HTMLElement>(".save_msg");
    const background = document.querySelector<HTMLElement>(".save_background");

    if (!dialog) {
        throw new Error("Save dialog not found");
    }

    const handleDialogClick = (event: MouseEvent): void => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const button = target.closest<HTMLElement>("[data-action]");
        if (!button) return;

        switch (button.dataset.action) {
            case "cancel":
                closePopup(dialog, background);

                dialog.remove();
                background?.remove();
                break;

            case "dont-save":
                closePopup(dialog, background);
                dialog.remove();
                background?.remove();
                break;

            case "save":
                closePopup(dialog, background);
        
                dialog.remove();
                background?.remove();
                break;
        }
    };

    dialog.addEventListener("click", handleDialogClick);
    background?.addEventListener("click", handleDialogClick);
}