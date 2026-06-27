const AdmZip = require("adm-zip");

// Agentic code builder. Turns a natural-language request (e.g. "make me a
// neon snake game") into a working web app and packages it as a deliverable
// file. Runs a bounded loop: plan -> generate -> self-review -> package.
//
// Output is a single self-contained index.html when possible (instantly
// playable), or a .zip when the model genuinely needs multiple files.
class AgentService {
  constructor(llmService) {
    this.llmService = llmService;
  }

  // Strip a fenced ```lang ... ``` block down to its contents. If there's no
  // fence, return the trimmed text as-is.
  stripFence(text) {
    if (!text) return "";
    const fence = text.match(/```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    return text.trim();
  }

  // Parse the model output into one or more files. Multi-file output uses
  // "=== FILE: name ===" markers; otherwise it's a single index.html.
  parseFiles(text) {
    const markerRegex = /===\s*FILE:\s*(.+?)\s*===/g;
    if (markerRegex.test(text)) {
      const files = [];
      const parts = text.split(/===\s*FILE:\s*(.+?)\s*===/g);
      // parts: ["", name1, body1, name2, body2, ...]
      for (let i = 1; i < parts.length; i += 2) {
        const name = parts[i].trim().replace(/[^a-zA-Z0-9._/-]/g, "_");
        const body = this.stripFence(parts[i + 1] || "");
        if (name && body) files.push({ name, content: body });
      }
      if (files.length) return files;
    }
    // Single-file fallback
    return [{ name: "index.html", content: this.stripFence(text) }];
  }

  // Step 1: a short plan/spec to steer generation (and to show the user)
  async plan(request) {
    const system =
      "You are a senior web developer. In 3-5 short bullet points, outline how you'd build the user's request as a single self-contained HTML file (features, controls, visual style). Be concise - no code.";
    try {
      const plan = await this.llmService.generateCode(request, system, 600);
      return (plan || "").trim();
    } catch {
      return "";
    }
  }

  // Step 2: generate the code
  async generate(request, plan) {
    const system = `You are an expert front-end engineer. Build a COMPLETE, working web app/game.

RULES:
- Prefer ONE self-contained file: index.html with all HTML, CSS and JS inline.
- No external build steps. Avoid external CDNs/libraries unless truly essential.
- Make it polished and actually playable/usable, not a stub.
- Output ONLY code. Put the file in a single \`\`\`html code block.
- If (and only if) you genuinely need multiple files, output each as:
  === FILE: index.html ===
  \`\`\`html
  ...
  \`\`\`
  === FILE: style.css ===
  \`\`\`css
  ...
  \`\`\``;
    const prompt = plan
      ? `Request: ${request}\n\nApproach:\n${plan}\n\nNow write the full code.`
      : `Request: ${request}\n\nNow write the full code.`;
    return this.llmService.generateCode(prompt, system, 8000);
  }

  // Step 3: self-review / repair pass
  async review(request, code) {
    const system =
      "You are a meticulous code reviewer. Fix any bugs, missing logic, or rough edges so the app fully works and looks polished. Return the COMPLETE corrected file(s) only, in the same format (code block, or === FILE: === blocks). Do not explain.";
    const prompt = `Original request: ${request}\n\nHere is the current code:\n\n${code}\n\nReturn the corrected, complete code.`;
    try {
      const fixed = await this.llmService.generateCode(prompt, system, 8000);
      return fixed && fixed.trim() ? fixed : code;
    } catch {
      return code; // keep the working version if review fails
    }
  }

  // Package files into a deliverable buffer
  packageFiles(files, baseName = "app") {
    if (files.length === 1 && /\.html?$/i.test(files[0].name)) {
      return {
        buffer: Buffer.from(files[0].content, "utf8"),
        fileName: `${baseName}.html`,
        mimetype: "text/html",
        multi: false,
        fileCount: 1,
      };
    }
    const zip = new AdmZip();
    for (const f of files) {
      zip.addFile(f.name, Buffer.from(f.content, "utf8"));
    }
    return {
      buffer: zip.toBuffer(),
      fileName: `${baseName}.zip`,
      mimetype: "application/zip",
      multi: true,
      fileCount: files.length,
    };
  }

  // Basic sanity check so we don't ship an empty/broken file
  looksValid(files) {
    if (!files.length) return false;
    const total = files.reduce((n, f) => n + (f.content?.length || 0), 0);
    if (total < 80) return false;
    const hasHtml = files.some((f) => /<html|<!doctype|<body|<canvas|<div|<script/i.test(f.content));
    return hasHtml || files.length > 1;
  }

  slugify(request) {
    return (
      String(request)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30) || "app"
    );
  }

  /**
   * Full agentic build.
   * @param {string} request - user's natural-language ask
   * @param {object} opts - { review?: boolean, onProgress?: (msg)=>void }
   * @returns {Promise<{buffer,fileName,mimetype,multi,fileCount,plan}>}
   */
  async build(request, opts = {}) {
    const { review = true, onProgress = () => {} } = opts;

    await onProgress("🧠 Planning the build...");
    const plan = await this.plan(request);

    await onProgress("✍️ Writing the code...");
    let raw = await this.generate(request, plan);
    if (!raw || !raw.trim()) throw new Error("Code generation returned empty");

    if (review) {
      await onProgress("🔍 Reviewing & fixing bugs...");
      raw = await this.review(request, raw);
    }

    await onProgress("📦 Packaging the file...");
    const files = this.parseFiles(raw);
    if (!this.looksValid(files)) {
      throw new Error("Generated output didn't look like a valid app");
    }
    const pkg = this.packageFiles(files, this.slugify(request));
    return { ...pkg, plan };
  }
}

module.exports = AgentService;
