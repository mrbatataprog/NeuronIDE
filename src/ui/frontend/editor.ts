import { Tree as Highlight, Parser, Language, Query } from "web-tree-sitter";
import init, { Editor } from "./modules/editor/editor.js";

import * as vscodeTextmate from "vscode-textmate";
import * as oniguruma from "vscode-oniguruma";
import onigWasmUrl from "vscode-oniguruma/release/onig.wasm?url";

import { FetchAsset } from "../assets";

export class TextMateHighlighter {
    private registry!: vscodeTextmate.Registry;
    private grammar!: vscodeTextmate.IGrammar;

    public async initialize() {
        const response = await fetch(onigWasmUrl);

        if (!response.ok) {
        throw new Error(`Failed to load Oniguruma WASM: ${response.status}`);
        }

        const wasm = await response.arrayBuffer();

        await oniguruma.loadWASM(wasm);

        const onigLib: vscodeTextmate.IOnigLib = { createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns), createOnigString: (value) => new oniguruma.OnigString(value), };

        this.registry = new vscodeTextmate.Registry({
            onigLib: Promise.resolve(onigLib),

            loadGrammar: async (scopeName) => {
                if (scopeName !== "source.ts") return null;

                const response = await FetchAsset("languages/ts.syntax.json");

                if (!response.ok) {
                    throw new Error(`Failed to load TypeScript grammar: ${response.status}`);
                }

                const grammar = await response.json();

                console.log("Loaded grammar:", grammar);
                console.log("Grammar scope:", grammar.scopeName);

                return grammar as vscodeTextmate.IRawGrammar;
            },
        });

        const grammar = await this.registry.loadGrammar("source.ts");

        if (!grammar) {
        throw new Error("Failed to load TypeScript grammar");
        }

        this.grammar = grammar;
    }

    private getCssClass(scopes: string[]): string {
        const scope = scopes.join(" ");

        if (/comment/.test(scope)) return "syntax-comment";
        if (/string/.test(scope)) return "syntax-string";
        if (/constant\.numeric/.test(scope)) return "syntax-number";

        if (/keyword|storage\.type|storage\.modifier/.test(scope)) { return "syntax-keyword"; }
        if (/entity\.name\.function|support\.function/.test(scope)) { return "syntax-function"; }
        if (/entity\.name\.type|support\.type/.test(scope)) { return "syntax-type"; }
        if (/variable\.language/.test(scope)) return "syntax-self";
        if (/variable\.other\.property|meta\.object-literal\.key/.test(scope)) { return "syntax-property"; }
        if (/punctuation\.definition\.typeparameters|punctuation\.bracket/.test(scope)) { return "syntax-brackets"; }

        return "syntax-default";
    }

    public tokenizeLine(line: string, previousState: vscodeTextmate.StateStack | null) {
        const result = this.grammar.tokenizeLine(line, previousState ?? vscodeTextmate.INITIAL);

        return {
            state: result.ruleStack,
            tokens: result.tokens.map((token) => ({
                startIndex: token.startIndex,
                endIndex: token.endIndex,
                scopes: token.scopes,
                cssClass: this.getCssClass(token.scopes),
            })),
        };
    }
}

// Temperaly. Going to be changed in the next update after 2.0.0
const editor = document.querySelector<HTMLDivElement>("#editor")!;
const sidelines = document.querySelector<HTMLPreElement>("#editor-lines")!;
const scroll = document.querySelector<HTMLDivElement>("#editor-scroll")!;
const content = document.querySelector<HTMLDivElement>("#editor-content")!;
const currentLine = document.querySelector<HTMLDivElement>("#editor-current-line")!;
const caret = document.querySelector<HTMLDivElement>("#editor-caret")!;

if (!editor || !sidelines || !scroll || !content || !currentLine || !caret) {
  throw new Error("Editor elements not found");
}

export interface SyntaxCapture {
    name: string;
    cssClass: string;
    text: string;
    startIndex: number;
    endIndex: number;
    line: number;
}

interface Position {
    line: number,
    col: number,

    text?: string,
    offset?: number,
}

interface ScrollingPositions {
    top: number,
    bottom: number,

    line: number
}

type ModifiedLine = {
    line: number;
    captures: SyntaxCapture[];
};

type ParseUpdate = {
    tree: Highlight;
    modifiedLines: number[];
    updatedCaptures: ModifiedLine[];
};

type Offset = {
    start: number,
    end: number,  
}


export class EditorModel {
    private editor!: Editor;
    private SelectedLine!: Position;
    private tokens = new Map<number, SyntaxCapture[]>();
    private addIndex = new Map<number, number>;
    private charWidth = 7.697265625;
    private measureFont = "";
    
    private selectedLineElement: HTMLElement | null = null;
    private measureContext = document.createElement("canvas").getContext("2d");
    private MouseTime?: Date;

   private visibleLines = new Map<number, HTMLElement>();
    private visibleSidebarLines = new Map<number, HTMLElement>();
    private space: Map<number, number> = new Map();
    private textMate = new TextMateHighlighter();
    private lineStates = new Map<number, vscodeTextmate.StateStack>();

    public async init() {
        await init();

        await this.textMate.initialize();

        this.editor = new Editor();

        this.SelectedLine = { line: 1, col: 0 };
        this.tokens = new Map();
        this.addIndex = new Map();
        this.UserInput();
    }

    
    private RenderModifiedLines(text: string = "", deleteBefore = false) {
        const line = this.SelectedLine.line - 1;
        const charIndex = (this.SelectedLine.offset ?? 0) + this.SelectedLine.col;
        
        if (deleteBefore) {
            if (charIndex <= 0) return;
            this.editor.delete(charIndex - 1, charIndex);
        } else {
            this.editor.insert(charIndex, text);
        }

        const updatedLine = this.editor.get_line_content(line) ?? "";
        this.SelectedLine.text = updatedLine;

        const previousState = line === 0 ? vscodeTextmate.INITIAL : this.lineStates.get(line - 1) ?? vscodeTextmate.INITIAL;
        const result = this.textMate.tokenizeLine(updatedLine, previousState);

        this.tokens.set(line,
            result.tokens.map((token) => ({
                name: token.cssClass,
                cssClass: token.cssClass,
                text: updatedLine.slice(token.startIndex, token.endIndex),
                startIndex: token.startIndex,
                endIndex: token.endIndex,
                line,
            }))
        );

        this.lineStates.set(line, result.state);

        const lineElement = content.querySelector(`[data-line="${line}"]`) as HTMLElement | null;
        this.RenderGuideLines(line, updatedLine);

        if (lineElement) {
            const newElement = this.RenderLine(updatedLine, line, this.GetCapturesForLine(line).captures);

            newElement.dataset.line = String(line);
            lineElement.replaceWith(newElement);
            this.visibleLines.set(line, newElement);
        }
            

        this.RenderCursor();
    }

    private ResetCaretBlink() {
        caret.classList.add("no-blink");

        requestAnimationFrame(() => {
        caret.classList.remove("no-blink");
        });
    }

    private SetCursorLine(line: number, toEnd = true) {
        const lineText = this.editor.get_line_content(line - 1) ?? "";
        const space = this.space.get(line - 1) ?? 0;

        this.SelectedLine.line = line;
        this.SelectedLine.text = lineText;
        this.SelectedLine.offset = this.editor.line_to_char(line - 1);
        this.SelectedLine.col = toEnd ? lineText.length : Math.min(this.SelectedLine.col, lineText.length);
    }

    private HandleArrows(key: string): boolean {
        const line = this.SelectedLine.line;
        const col = this.SelectedLine.col;
        const lineCount = this.editor.line_count();
        let lineText = this.SelectedLine.text ?? "";
        lineText = lineText.slice(0, -1);
        
        switch (key) {
            case "ArrowUp": if (line <= 1) return true; this.SetCursorLine(line - 1); break;
            case "ArrowDown": if (line >= lineCount) return true; this.SetCursorLine(line + 1); break;
            case "ArrowRight":
                if (col < lineText.length) { this.SelectedLine.col++;
                } else if (line < lineCount) { this.SetCursorLine(line + 1); this.SelectedLine.col = 0;
                } else { return true; }
                break;

            case "ArrowLeft":
                if (col > 0) { this.SelectedLine.col--; } 
                else if (line > 1) { this.SetCursorLine(line - 1); this.SelectedLine.col = (this.SelectedLine.text ?? "").length; } 
                else { return false; }
                break;
            default: return false;
        }

        this.RenderCursor(true);
        return true;
    }

    private UserInput() {
        editor.addEventListener("keydown", (event: KeyboardEvent) => {
        this.ResetCaretBlink();
        
        const allowedKeys = [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Backspace",
            "Delete",
            "Tab",
            "Enter",
        ];

        const isTyping = event.key.length === 1 && !event.ctrlKey && !event.metaKey;

        if (!allowedKeys.includes(event.key) && !isTyping) {
            return;
        }

        event.preventDefault();

        const lineIndex = this.SelectedLine.line - 1;
        
        if (this.HandleArrows(event.key)) {
            return;
        }

        if (event.key === "Space") {
            event.preventDefault();
            this.RenderModifiedLines(" ");

            this.SelectedLine.col += 1;
            this.RenderCursor();
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();

            this.RenderModifiedLines("    ");
            this.SelectedLine.col += "    ".length;

            this.RenderCursor();
            return;
        }

        if (event.key === "Backspace") {
            event.preventDefault();

            if (this.SelectedLine.line <= 0) return;
            if (event.key === "Backspace") {
                event.preventDefault();

                if (this.SelectedLine.col === 0) {
                    if (this.SelectedLine.line <= 1) return;

                    const currentLine = this.SelectedLine.line - 1;
                    const length = this.SelectedLine.text?.length ?? 0;
                    const charIndex = this.SelectedLine.offset ?? 0;

                    this.editor.delete(charIndex - 1, charIndex);
                    this.SelectedLine.line--;

                    for (const key of this.tokens.keys()) { if (key >= currentLine - 1) this.tokens.delete(key); }
                    for (const key of this.lineStates.keys()) { if (key >= currentLine - 1) this.lineStates.delete(key); }

                    const result = this.ReTokenize();

                    this.RenderEditor(result.registered, result.totalLines, result.startLine, result.endLine);

                    if (length !== 0) {
                    this.SetCursorLine(this.SelectedLine.line, false);
                    this.RenderCursor();
                    return;
                    }

                    this.SetCursorLine(this.SelectedLine.line);
                    this.RenderCursor();

                    return;
                }
            }

            this.RenderModifiedLines("", true);

            this.SelectedLine.col--;
            this.RenderCursor();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();

            const line = this.SelectedLine.line - 1;
            const length = this.SelectedLine.text?.length ?? 0;
            const charIndex = (this.SelectedLine.offset ?? 0) + this.SelectedLine.col;

            this.editor.insert(charIndex, "\n");
            this.SelectedLine.line++;
            this.SelectedLine.col = 0;

            for (const key of this.tokens.keys()) { if (key >= line) this.tokens.delete(key); }
            for (const key of this.lineStates.keys()) { if (key >= line) this.lineStates.delete(key); }

            const result = this.ReTokenize();

            this.RenderEditor(result.registered, result.totalLines, result.startLine, result.endLine);

            if (length !== 0) {
                this.SetCursorLine(this.SelectedLine.line, false);
                this.RenderCursor();

                return;
            }

            this.SetCursorLine(this.SelectedLine.line);
            this.RenderCursor();

            return;
        }

        if (event.key.length > 1) { return; }

        this.RenderModifiedLines(event.key);
            this.SelectedLine.col += 1;
            this.RenderCursor();
        });

        editor.addEventListener("mousedown", (event: MouseEvent) => {
            this.MouseTime = new Date();
        });

        editor.addEventListener("click", (event: MouseEvent) => {
            const target = event.target;

            if (!(target instanceof HTMLElement)) return;

            const lineElement = target.closest<HTMLElement>(".editor-line");
            if (!lineElement) return;

            const line = Number(lineElement.dataset.line);
            if (!Number.isFinite(line)) return;

            const rect = lineElement.getBoundingClientRect();
            const style = getComputedStyle(lineElement);

            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const x = event.clientX - rect.left - paddingLeft;

            const lineText = this.editor.get_line_content(line) ?? "";
            const column = Math.max(0, Math.min(lineText.length, Math.round(x / this.charWidth)));

            this.SelectedLine.line = line + 1;
            this.SelectedLine.col = column;
            this.SelectedLine.text = lineText;
            this.SelectedLine.offset = this.editor.line_to_char(line);

            this.RenderCursor();
        });

        scroll.addEventListener("scroll", () => {
            const lineHeight = 21;
            const preLoad = 25;
            const totalLines = this.editor.line_count();

            const firstVisibleLine = Math.max(0, Math.floor(scroll.scrollTop / lineHeight) - preLoad);
            const lastVisibleLine = Math.min(totalLines, Math.ceil((scroll.scrollTop + scroll.clientHeight) / lineHeight) + preLoad);
            const visibleLines = new Set<number>();

            let i = 0;

            for (let line = firstVisibleLine; line < lastVisibleLine; line++) {
                visibleLines.add(line);

                if (this.visibleLines.has(line)) {
                    continue;
                }

                
                const capture = this.tokens.get(line);
                const lineText = this.editor.get_line(line) ?? "";

                if (!capture) {
                    const previousState = line === 0 ? vscodeTextmate.INITIAL : this.lineStates.get(line - 1) ?? vscodeTextmate.INITIAL;
                    const result = this.textMate.tokenizeLine(lineText, previousState);

                    this.tokens.set(
                        line,
                        result.tokens.map(token => ({
                        name: token.cssClass,
                        cssClass: token.cssClass,
                        text: lineText.slice(token.startIndex, token.endIndex),
                        startIndex: token.startIndex,
                        endIndex: token.endIndex,
                        line,
                        }))
                    );

                    this.lineStates.set(line, result.state);
                }

                const element = this.RenderLine(lineText, line, this.GetCapturesForLine(line).captures);

                element.dataset.line = String(line);
                this.visibleLines.set(line, element);

                this.InsertLineInOrder(content, element, line);
                const sidebarElement = this.CreateLineNumber(line);
                sidebarElement.dataset.line = String(line);

                this.visibleSidebarLines.set(line, sidebarElement);
                this.InsertLineInOrder(sidelines, sidebarElement, line);
                this.RenderGuideLines(line, lineText);
            }

            for (const [line, element] of this.visibleLines) {
                if (!visibleLines.has(line)) {
                    element.remove();
                    this.visibleLines.delete(line);

                    this.visibleSidebarLines.get(line)?.remove();
                    this.visibleSidebarLines.delete(line);
                }
            }

            content.style.paddingTop = `${firstVisibleLine * lineHeight}px`;
            content.style.paddingBottom = `${Math.max(0, totalLines - lastVisibleLine) * lineHeight}px`;

            sidelines.style.transform = `translateY(${-scroll.scrollTop}px)`;
            sidelines.style.paddingTop = `${firstVisibleLine * lineHeight + 5}px`;
            sidelines.style.paddingBottom = `${Math.max(0, totalLines - lastVisibleLine) * lineHeight}px`;

            this.RenderCursor();
        });
    }

    private InsertLineInOrder(container: HTMLElement, element: HTMLElement, line: number) {
        const next = Array.from(container.children).find(child => Number((child as HTMLElement).dataset.line) > line);
        container.insertBefore(element, next ?? null);
    }

    private GetCapturesForLine(line: number): { captures: SyntaxCapture[], addIndex: number } {
        const captures = this.tokens.get(line) ?? [];
        const addIndex = this.addIndex.get(line) ?? 0;

        return { captures, addIndex };
    }

    private CreateLineNumber(line: number): HTMLDivElement {
        const number = document.createElement("div");

        number.textContent = String(line + 1);
        number.dataset.line = String(line);
        number.classList.toggle(
            "active-line-number",
            line + 1 === this.SelectedLine.line
        );

        return number;
    }

    private RenderLine(lineText: string, lineNumber: number, captures: SyntaxCapture[]): HTMLDivElement {
        let position = 0;

        const lineElement = document.createElement("div");
        const guides = document.createElement("div");

        guides.className = "indent-guides";

        lineElement.className = "editor-line";
        lineElement.dataset.line = String(lineNumber);
        lineElement.style.height = "21px";
        lineElement.style.lineHeight = "21px";
        lineElement.style.boxSizing = "border-box";
        lineElement.style.position = "relative";

        const leadingSpaces = lineText.length - lineText.trimStart().length;
        let space = Math.floor(leadingSpaces / 4);

        if (lineText.trim().length === 0) {
            space = this.space.get(lineNumber - 1) ?? 0;
        }

        this.space.set(lineNumber, space);

        for (let level = 0; level < space; level++) {
            const guide = document.createElement("span");

            guide.className = "indent-guide";
            guide.style.left = `${level * 4 * this.charWidth}px`;

            guides.appendChild(guide);
        }

        lineElement.prepend(guides);

        for (const capture of captures) {
            const start = Math.max(0, capture.startIndex);
            const end = Math.min(lineText.length, capture.endIndex);

            if (start >= lineText.length || end <= position) continue;

            if (start > position) {
                lineElement.append(document.createTextNode(lineText.slice(position, start)));
            }

            const span = document.createElement("span");
            span.className = capture.cssClass;
            span.textContent = lineText.slice(Math.max(position, start), end);

            lineElement.append(span);

            position = end;
        }

        if (position < lineText.length) {
            lineElement.append(document.createTextNode(lineText.slice(position)));
        }

        if (lineText.length === 0) {
            lineElement.append(document.createElement("br"));
        }

        return lineElement;
    }

    
    private ReTokenize(): {registered: Map<number, string>;totalLines: number; startLine: number; endLine: number;} {
        const lineHeight = 21;
        const extraLines = 30;
        const totalLines = this.editor.line_count();

        const firstVisibleLine = Math.floor(scroll.scrollTop / lineHeight);
        const visibleCount = Math.ceil(scroll.clientHeight / lineHeight);

        const startLine = Math.max(0, firstVisibleLine - extraLines);
        const endLine = Math.min( totalLines,firstVisibleLine + visibleCount + extraLines);
        let checkpoint = startLine - 1;

        while (checkpoint >= 0 && !this.lineStates.has(checkpoint)) {
            checkpoint--;
        }

        let previousState = checkpoint >= 0 ? this.lineStates.get(checkpoint)! : vscodeTextmate.INITIAL;
        const registered = new Map<number, string>();

        for (let i = checkpoint + 1; i < endLine; i++) {
            const lineText = this.editor.get_line_content(i) ?? "";

            const result = this.textMate.tokenizeLine(lineText, previousState);
            previousState = result.state;

            this.tokens.set(i, result.tokens.map(token => ({
                    name: token.cssClass,
                    cssClass: token.cssClass,
                    text: lineText.slice(
                        token.startIndex,
                        token.endIndex
                    ),
                    startIndex: token.startIndex,
                    endIndex: token.endIndex,
                    line: i,
                }))
            );

            this.lineStates.set(i, result.state);

            if (i >= startLine) {
                registered.set(i, lineText);
            }
        }

        return { registered, totalLines, startLine, endLine, };
    }


    private RenderEditor(registered: Map<number, string>, total: number, startLine: number, endLine: number) {
        const lineHeight = 21;
        const fragment = document.createDocumentFragment();
        const sidebarFragment = document.createDocumentFragment();

        this.visibleLines.clear();
        this.visibleSidebarLines.clear();

        for (let line = startLine; line < endLine; line++) {
            const lineText = registered.get(line) ?? "";

            const sidebarElement = this.CreateLineNumber(line);
            this.visibleSidebarLines.set(line, sidebarElement);
            sidebarFragment.appendChild(sidebarElement);

            this.RenderGuideLines(line, lineText);

            const element = this.RenderLine(lineText, line, this.GetCapturesForLine(line).captures);

            element.dataset.line = String(line);
            this.visibleLines.set(line, element);

            fragment.appendChild(element);
        }

        content.replaceChildren(fragment);
        sidelines.replaceChildren(sidebarFragment);

        content.style.paddingTop = `${startLine * lineHeight}px`;
        content.style.paddingBottom = `${Math.max(0, total - endLine) * lineHeight}px`;

        sidelines.style.paddingTop = `${startLine * lineHeight + 5}px`;
        sidelines.style.paddingBottom = `${Math.max(0, total - endLine) * lineHeight}px`;

        this.RenderCursor();
    }

    private RenderCursor(disable = false) {
        const lineNumbers = sidelines.querySelectorAll<HTMLElement>("div");

        lineNumbers.forEach((number) => {
            const line = Number(number.dataset.line);

            number.classList.toggle("active-line-number", line + 1 === this.SelectedLine.line);
        });

        this.selectedLineElement?.classList.remove("selected-line");
        this.selectedLineElement = null;

        const lineElement = content.querySelector<HTMLElement>(`[data-line="${this.SelectedLine.line - 1}"]`);

        if (!lineElement) {
            caret.style.display = "none";
            return;
        }

        this.selectedLineElement = lineElement;
        lineElement.classList.add("selected-line");

        const length = this.SelectedLine.text?.length ?? 0;
        const column = disable ?  this.SelectedLine.col : Math.min(this.SelectedLine.col, length);
        const ctx = this.measureContext;

        if (!ctx) {
        caret.style.display = "none";
        return;
        }

        const style = getComputedStyle(lineElement);

        if (this.measureFont !== style.font) {
            ctx.font = style.font;
            this.measureFont = style.font;
        }

        const lineStart = this.SelectedLine.offset ?? 0;
        const prefixWidth = ctx.measureText(this.editor.get_range(lineStart, lineStart + column)).width;

        const letterSpacing = parseFloat(style.letterSpacing);
        const spacing = Number.isFinite(letterSpacing) ? letterSpacing * column : 0;
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const contentRect = content.getBoundingClientRect();
        const lineRect = lineElement.getBoundingClientRect();

        caret.style.left = `${lineRect.left - contentRect.left + paddingLeft + prefixWidth + spacing}px`;
        caret.style.top = `${lineRect.top - contentRect.top}px`;
        caret.style.height = `${lineRect.height}px`;
        caret.style.display = "block";

        this.SelectedLine.line

        if (caret.parentElement !== content) {
        content.appendChild(caret);
        }
    }

    private RenderGuideLines(line: number, text: string) {
        const leadingSpaces = text.length - text.trimStart().length;
        const previous = this.space.get(line - 1) ?? 0;

        let levels = Math.floor(leadingSpaces / 4);

        if (text.trim().length === 0) {
            levels = previous;
        }

        this.space.set(line, levels);
    }

    public async Insert(current: string) {        
        this.editor.insert(this.editor.char_count(), current);
    }

    public async NewRender() {
        this.visibleLines.clear();
        this.visibleSidebarLines.clear();
        
        let previousState: vscodeTextmate.StateStack = vscodeTextmate.INITIAL;
        const fragment = document.createDocumentFragment();
    
        const lineHeight = 21;
        const extraLines = 30;
        const totalLines = this.editor.line_count();

        const firstVisibleLine = Math.floor(scroll.scrollTop / lineHeight);
        const visibleLines = Math.ceil(scroll.clientHeight / lineHeight);

        const startLine = Math.max(0, firstVisibleLine - extraLines);
        const endLine = Math.min(totalLines, firstVisibleLine + visibleLines + extraLines);
        const registered: Map<number, string> = new Map();
    
        sidelines.replaceChildren();

        for (let line = startLine; line < endLine; line++) {
            const lineText = this.editor.get_line_content(line) ?? "";
            const result = this.textMate.tokenizeLine(lineText, previousState);

            this.tokens.set(line, result.tokens.map((token) => ({
                name: token.cssClass,
                cssClass: token.cssClass,
                text: lineText.slice(token.startIndex, token.endIndex),
                startIndex: token.startIndex,
                endIndex: token.endIndex,
                line,
                }))
            );

            registered.set(line, lineText);
            previousState = result.state;

            this.lineStates.set(line, previousState);

            if (line >= startLine) { registered.set(line, lineText); }
        }
    
        for (let line = startLine; line < endLine; line++) {
            const lineText = registered.get(line) ?? "";

            const sidebarElement = this.CreateLineNumber(line);
            this.visibleSidebarLines.set(line, sidebarElement);
            sidelines.appendChild(sidebarElement);

            this.RenderGuideLines(line, lineText);

            const element = this.RenderLine(lineText, line, this.GetCapturesForLine(line).captures);

            element.dataset.line = String(line);
            this.visibleLines.set(line, element);

            fragment.appendChild(element);
        }

        content.replaceChildren(fragment);
        content.style.paddingTop = `${startLine * lineHeight}px`;
        content.style.paddingBottom = `${Math.max(0, totalLines - endLine) * lineHeight}px`;

        this.RenderCursor();
    }
    
    public ResetEditor(): void {
        this.visibleLines.clear();
        this.visibleSidebarLines.clear();
        this.space.clear();
        this.tokens.clear();
        this.lineStates.clear();
        this.addIndex.clear();
        this.SelectedLine = { line: 1, col: 0, offset: 0, text: "" };

        const charCount = this.editor.char_count();
        this.editor.delete(0, charCount);

        content.replaceChildren();
        sidelines.replaceChildren();

        sidelines.style.transform = "translateY(0px)";

        scroll.scrollTop = 0;
        scroll.scrollLeft = 0;

        caret.style.display = "none";
        caret.style.left = "0px";
        caret.style.top = "0px";

        this.selectedLineElement?.classList.remove("selected-line");
        this.selectedLineElement = null;

        currentLine.replaceChildren();
    }

    public CreateContext(id: number) {        
        this.editor.create_buffer(id);
        this.editor.switch_buffer(id);
    }

    public RemoveContext(id: number) {
        this.editor.remove_buffer(id);
    }

    public SwitchContext(id: number) {
        this.editor.switch_buffer(id);
        this.NewRender();
    }

    public HasContext(id: number): boolean {
        return this.editor.has_buffer(id);
    }

    public GetSavedForContext(id: number) {
        return this.editor.get_buffer_text(id);
    }

    public GetSaved() {
        return this.editor.get_text();
    }
}