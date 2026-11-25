import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const closebtn = document.getElementById("close");
const minimizebtn = document.getElementById("minimize");
const maximizebtn = document.getElementById("maximize");

closebtn?.addEventListener("click", async () => {
    await appWindow.close();
});

minimizebtn?.addEventListener("click", async () => {
    await appWindow.minimize();
});

maximizebtn?.addEventListener("click", async () => {
    await appWindow.toggleMaximize();
});

export function SetPath(path: string) {
    sessionStorage.setItem("window_path", path);
}

export function GetPath() {
    return sessionStorage.getItem("window_path");
}