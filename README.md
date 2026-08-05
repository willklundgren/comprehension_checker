# Did You Really Get That?

A local-first Firefox add-on proof of concept that turns the article in the active tab into a three-question comprehension check.

## What works now

- Extracts article-like text from regular web pages.
- Generates three multiple-choice, fill-in-the-blank questions locally.
- Scores answers and shows the supporting sentence.
- Jumps back to and temporarily highlights the source paragraph.
- Sends no browsing data anywhere.
- Reads and processes article text locally only when you open the add-on.

The local question generator is intentionally simple. It establishes the product flow without putting a secret LLM API key inside a browser extension. The generator is isolated in `popup/quiz-generator.js` so it can later be replaced by a call to a small backend.

## Try it in Firefox

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on…**.
4. Select this project's `manifest.json`.
5. Open a substantial article on an `http` or `https` page.
6. Click the add-on button, then **Make me a 3-question quiz**.

After loading or reloading the temporary add-on, refresh any article tabs that were already open. Newly opened pages are ready automatically.

Firefox removes temporary add-ons when the browser restarts, so repeat these steps after a restart.

## Validate the code

No dependencies are required. With Node.js installed, run:

```sh
npm run check
```

## Project structure

```text
manifest.json                 Firefox Manifest V3 configuration
content/article-reader.js     Article extraction and source highlighting
content/highlight.css         In-page highlight style
popup/popup.html              Add-on interface
popup/popup.css               Interface styling
popup/popup.js                Quiz flow and browser messaging
popup/quiz-generator.js       Replaceable local quiz generator
```

## Sensible next step: add an LLM safely

Add a tiny server endpoint such as `POST /quiz` that accepts `{ title, url, text }` and returns:

```json
{
  "questions": [
    {
      "prompt": "What is the author's main reason for ...?",
      "options": ["...", "...", "...", "..."],
      "answer": "...",
      "evidence": "An exact sentence from the supplied article"
    }
  ]
}
```

Keep the model provider's API key on that server. Have the server validate the response and match each `evidence` string back to the article before returning it. The add-on can then map that evidence to a source paragraph and preserve the current highlighting experience.
