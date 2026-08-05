(function () {
  "use strict";

  const api = globalThis.browser || globalThis.chrome;
  const views = [...document.querySelectorAll(".view")];
  const state = { article: null, questions: [], index: 0, score: 0, answered: false, tabId: null };

  const el = (id) => document.getElementById(id);
  const showView = (id) => views.forEach((view) => view.classList.toggle("hidden", view.id !== id));

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value;
    return node.innerHTML;
  }

  function showError(message) {
    el("error-message").textContent = message;
    showView("error-view");
  }

  async function requestArticle(tabId) {
    const response = await api.tabs.sendMessage(tabId, { type: "GET_ARTICLE" });
    if (response?.error) throw new Error(response.error);
    return response;
  }

  async function installReaderInExistingTab(tabId) {
    await api.scripting.executeScript({ target: { tabId }, files: ["content/article-reader.js"] });
    try {
      await api.scripting.insertCSS({ target: { tabId }, files: ["content/highlight.css"] });
    } catch (error) {
      // Highlight styling is helpful but should never prevent quiz creation.
      console.warn("Comprehension Checker could not install highlight styles", error);
    }
  }

  async function getActiveArticle() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      throw new Error("Open a regular web article first. Firefox’s internal pages cannot be read by add-ons.");
    }
    state.tabId = tab.id;
    let article;
    try {
      article = await requestArticle(tab.id);
    } catch (initialError) {
      try {
        await installReaderInExistingTab(tab.id);
        article = await requestArticle(tab.id);
      } catch (fallbackError) {
        console.error("Comprehension Checker could not access this tab", { initialError, fallbackError });
        throw new Error("Firefox couldn’t give the add-on access to this tab. Reload the article once, then open the add-on again.");
      }
    }
    if (!article || !article.text) throw new Error("I couldn’t find readable article text on this page.");
    return article;
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    state.answered = false;
    el("progress-label").textContent = `Question ${state.index + 1} of ${state.questions.length}`;
    el("score-label").textContent = state.index ? `${state.score} correct` : "";
    el("progress-bar").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
    const [lead, excerpt] = question.prompt.split("\n\n");
    el("question").innerHTML = `${escapeHtml(lead)}<br><br>${escapeHtml(excerpt).replace("_____", '<span class="blank">_____</span>')}`;
    el("feedback").classList.add("hidden");
    el("next-button").classList.add("hidden");
    el("answers").replaceChildren(...question.options.map((option) => {
      const button = document.createElement("button");
      button.className = "answer";
      button.textContent = option;
      button.addEventListener("click", () => answerQuestion(option, button));
      return button;
    }));
  }

  function answerQuestion(selected, selectedButton) {
    if (state.answered) return;
    state.answered = true;
    const question = state.questions[state.index];
    const correct = selected.toLowerCase() === question.answer.toLowerCase();
    if (correct) state.score += 1;

    for (const button of el("answers").querySelectorAll("button")) {
      button.disabled = true;
      if (button.textContent.toLowerCase() === question.answer.toLowerCase()) button.classList.add("correct");
    }
    if (!correct) selectedButton.classList.add("incorrect");
    el("feedback-title").textContent = correct ? "That’s it." : `The answer is “${question.answer}.”`;
    el("evidence").textContent = `“${question.evidence}”`;
    el("feedback").classList.remove("hidden");
    el("next-button").textContent = state.index === state.questions.length - 1 ? "See my result" : "Next question";
    el("next-button").classList.remove("hidden");
  }

  function renderResults() {
    el("final-score").textContent = `${state.score}/${state.questions.length}`;
    el("result-title").textContent = state.score === 3 ? "You got it." : state.score === 2 ? "Pretty solid." : "Worth another look.";
    el("result-message").textContent = state.score === 3
      ? "All three ideas stuck. Nice reading."
      : "Use the source highlights to revisit anything that didn’t stick.";
    showView("results-view");
  }

  function startQuiz() {
    try {
      state.questions = window.QuizGenerator.generateQuiz(state.article, 3);
      state.index = 0;
      state.score = 0;
      showView("quiz-view");
      renderQuestion();
    } catch (error) {
      showError(error.message);
    }
  }

  el("start-button").addEventListener("click", startQuiz);
  el("retry-button").addEventListener("click", startQuiz);
  el("next-button").addEventListener("click", () => {
    state.index += 1;
    if (state.index >= state.questions.length) renderResults(); else renderQuestion();
  });
  el("show-source").addEventListener("click", async () => {
    const question = state.questions[state.index];
    await api.tabs.sendMessage(state.tabId, { type: "HIGHLIGHT_SOURCE", sourceId: question.sourceId });
    window.close();
  });

  getActiveArticle()
    .then((article) => {
      state.article = article;
      el("page-title").textContent = article.title || "Untitled page";
      el("page-meta").textContent = `${article.wordCount.toLocaleString()} words found · about ${Math.max(1, Math.round(article.wordCount / 220))} min read`;
      el("start-button").disabled = false;
    })
    .catch((error) => showError(error?.message || "The page could not be read. Reload it once and try again."));
})();
