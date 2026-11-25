export async function FetchAsset(path: string): Promise<Response> {
    const base = import.meta.env.BASE_URL;
    const url = `${base}${path.replace(/^\/+/, "")}`;

    console.log("[FetchAsset]", url);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response;
}