import { type Scene, sceneToSvg } from "../render/scene";

const TOKENS = [
  "bg",
  "fg",
  "muted",
  "line",
  "marker",
  "marker-bg",
  "selected",
  "selected-stroke",
] as const;

/** Standalone SVG with the host's `--pm-*` colours inlined, so it renders outside the page. */
export function standaloneSvg(scene: Scene, host: Element | null): string {
  const style = host ? getComputedStyle(host) : null;
  const vars = TOKENS.map((t) => {
    const value = style?.getPropertyValue(`--pm-${t}`).trim();
    return value ? `--pm-${t}:${value};` : "";
  }).join("");
  const svg = sceneToSvg(scene);
  return svg.replace(
    "<defs>",
    `<style>svg{${vars}}</style><rect width="100%" height="100%" fill="var(--pm-bg)"/><defs>`,
  );
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(scene: Scene, host: Element | null, name = "process-map"): void {
  download(new Blob([standaloneSvg(scene, host)], { type: "image/svg+xml" }), `${name}.svg`);
}

/** Rasterise through an <img>; `scale` 2 gives a crisp image on high-density screens and in print. */
export function downloadPng(
  scene: Scene,
  host: Element | null,
  name = "process-map",
  scale = 2,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([standaloneSvg(scene, host)], { type: "image/svg+xml" }),
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(scene.width * scale);
      canvas.height = Math.ceil(scene.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("png encoding failed"));
        download(blob, `${name}.png`);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("svg could not be rendered"));
    img.src = url;
  });
}

/** PDF goes through the browser's print dialog: a page sized to the drawing, nothing else on it. */
export function printPdf(scene: Scene, host: Element | null, name = "process-map"): void {
  const w = window.open("", "_blank");
  if (!w) return;
  const mm = (px: number) => `${Math.ceil(px * 0.2646) + 10}mm`;
  w.document.write(
    `<!doctype html><title>${name}</title><style>@page{size:${mm(scene.width)} ${mm(scene.height)};margin:5mm}html,body{margin:0}svg{width:100%;height:auto;display:block}</style>${standaloneSvg(scene, host)}`,
  );
  w.document.close();
  w.focus();
  w.addEventListener("afterprint", () => w.close());
  setTimeout(() => w.print(), 150);
}
