(function () {
  "use strict";
  if (window.__comprehensionCheckerInstalled) return;
  window.__comprehensionCheckerInstalled = true;
  const api = globalThis.browser || globalThis.chrome;
  const SOURCE_ATTRIBUTE = "data-comprehension-source";

  function isVisible(element) {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().height > 0;
  }

  function articleRoot() {
    const candidates = [...document.querySelectorAll("article, main, [role='main']")].filter(isVisible);
    if (candidates.length) return candidates.sort((a, b) => b.innerText.length - a.innerText.length)[0];
    return document.body;
  }

  function extractArticle() {
    const root = articleRoot();
    const blocks = [...root.querySelectorAll("p, li, blockquote")]
      .filter(isVisible)
      .filter((node) => !node.closest("nav, footer, header, aside, form, [aria-hidden='true']"))
      .map((node) => ({ node, text: node.innerText.replace(/\s+/g, " ").trim() }))
      .filter(({ text }) => text.length >= 45);

    const sentences = [];
    let sourceIndex = 0;
    for (const block of blocks) {
      const parts = block.text.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
      for (const raw of parts) {
        const text = raw.trim();
        if (text.length < 35) continue;
        const id = `cc-source-${sourceIndex++}`;
        block.node.setAttribute(SOURCE_ATTRIBUTE, block.node.getAttribute(SOURCE_ATTRIBUTE) || id);
        sentences.push({ id: block.node.getAttribute(SOURCE_ATTRIBUTE), text });
      }
    }
    const text = blocks.map((block) => block.text).join("\n");
    return {
      title: document.querySelector("h1")?.innerText.trim() || document.title,
      text,
      sentences,
      wordCount: (text.match(/\S+/g) || []).length,
      url: location.href
    };
  }

  function highlightSource(sourceId) {
    document.querySelectorAll(".comprehension-checker-highlight").forEach((node) => node.classList.remove("comprehension-checker-highlight"));
    const source = document.querySelector(`[${SOURCE_ATTRIBUTE}="${CSS.escape(sourceId)}"]`);
    if (!source) return false;
    source.classList.add("comprehension-checker-highlight");
    source.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => source.classList.remove("comprehension-checker-highlight"), 9000);
    return true;
  }

  api.runtime.onMessage.addListener((message) => {
    if (message.type === "GET_ARTICLE") {
      try {
        return Promise.resolve(extractArticle());
      } catch (error) {
        console.error("Comprehension Checker could not extract this article", error);
        return Promise.resolve({ error: "This page’s layout prevented the article text from being read." });
      }
    }
    if (message.type === "HIGHLIGHT_SOURCE") {
      try {
        return Promise.resolve(highlightSource(message.sourceId));
      } catch (error) {
        console.error("Comprehension Checker could not highlight the source", error);
        return Promise.resolve(false);
      }
    }
    return undefined;
  });
})();
