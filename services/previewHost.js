const axios = require("axios");

// Publishes a single self-contained HTML file to a free host and returns a
// shareable, in-browser-renderable link. Uses a GitHub Gist (one API call)
// plus githack, which re-serves the gist's raw file with the correct
// content-type so the page actually renders (GitHub's own raw URL serves
// HTML as text/plain). Requires a free GITHUB_TOKEN with "gist" scope.
class PreviewHost {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  isEnabled() {
    return (
      !!this.githubToken &&
      this.githubToken !== "your_github_token_here" &&
      this.githubToken.length > 10
    );
  }

  /**
   * Upload HTML as a public gist and return a githack preview URL.
   * @returns {Promise<string|null>} preview URL, or null if disabled/failed
   */
  async publishHtml(html, description = "Eden build preview") {
    if (!this.isEnabled()) return null;
    if (!html || !html.trim()) return null;

    try {
      const res = await axios.post(
        "https://api.github.com/gists",
        {
          description,
          public: true,
          files: { "index.html": { content: html } },
        },
        {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "eden-bot",
          },
          timeout: 20000,
        },
      );

      const data = res.data || {};
      const gistId = data.id;
      const owner = data.owner && data.owner.login;
      if (!gistId || !owner) return null;

      // githack renders gist raw files with the proper content-type
      return `https://gist.githack.com/${owner}/${gistId}/raw/index.html`;
    } catch (err) {
      console.warn(
        "Preview publish failed:",
        err.response?.status || err.message,
      );
      return null;
    }
  }
}

module.exports = new PreviewHost();
