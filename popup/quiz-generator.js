(function () {
  "use strict";

  const STOP_WORDS = new Set((
    "a an and are as at be been being but by can could did do does doing for from had has have having he her here hers herself him himself his how i if in into is it its itself just may me might more most my myself no nor not of on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves also about after again against all any because before between both during each few further off ought per since still theirs therefore thus upon via whether within without" 
  ).split(/\s+/));

  function normalizeWord(word) {
    return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9'-]+$/g, "");
  }

  function wordCandidates(text) {
    const counts = new Map();
    const display = new Map();
    for (const raw of text.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []) {
      const word = normalizeWord(raw);
      if (STOP_WORDS.has(word) || word.length < 5) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
      if (!display.has(word)) display.set(word, raw);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(([word, count]) => ({ word, count, display: display.get(word) }));
  }

  function seededShuffle(items, seed) {
    const result = [...items];
    let state = seed || 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function stringSeed(text) {
    let hash = Date.now() >>> 0;
    for (let i = 0; i < Math.min(text.length, 4000); i += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function generateQuiz(article, count = 3) {
    const rankedWords = wordCandidates(article.text);
    const availableDistractors = rankedWords.slice(0, 35);
    const seed = stringSeed(article.text);
    const sentencePool = seededShuffle(article.sentences, seed)
      .filter((sentence) => sentence.text.length >= 65 && sentence.text.length <= 260);
    const questions = [];
    const usedWords = new Set();

    for (const sentence of sentencePool) {
      const inSentence = rankedWords.filter(({ word }) =>
        !usedWords.has(word) && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence.text)
      );
      const answer = inSentence[0];
      if (!answer) continue;

      const distractors = availableDistractors
        .filter((candidate) => candidate.word !== answer.word && !new RegExp(`\\b${candidate.word}\\b`, "i").test(sentence.text))
        .filter((candidate) => Math.abs(candidate.word.length - answer.word.length) <= 6)
        .slice(0, 8);
      if (distractors.length < 3) continue;

      const blanked = sentence.text.replace(
        new RegExp(`\\b${answer.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
        "_____"
      );
      const options = seededShuffle(
        [answer.display, ...seededShuffle(distractors, seed + questions.length).slice(0, 3).map((item) => item.display)],
        seed + questions.length * 17
      );

      questions.push({
        prompt: `Which word best completes this idea from the article?\n\n${blanked}`,
        options,
        answer: answer.display,
        evidence: sentence.text,
        sourceId: sentence.id
      });
      usedWords.add(answer.word);
      if (questions.length === count) break;
    }

    if (questions.length < count) {
      throw new Error("This page does not have enough article-like text to make a useful quiz yet.");
    }
    return questions;
  }

  window.QuizGenerator = { generateQuiz };
})();
