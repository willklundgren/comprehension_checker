const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

global.window = {};
eval(fs.readFileSync(path.join(__dirname, "../popup/quiz-generator.js"), "utf8"));

function articleFrom(text) {
  return {
    text,
    sentences: (text.match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((sentence, id) => ({
      id: String(id),
      text: sentence.trim()
    }))
  };
}

test("generates three answerable questions with article evidence", () => {
  const article = articleFrom(
    "Scientists studying urban forests have found that mature trees reduce neighborhood temperatures during extreme heat. " +
    "Their leaves provide shade while transpiration releases water vapor and cools the surrounding air. " +
    "City planners increasingly treat tree cover as essential infrastructure rather than simple decoration. " +
    "Neighborhoods with fewer trees often experience substantially higher summer temperatures than nearby leafy areas. " +
    "This disparity frequently overlaps with historic patterns of housing discrimination and uneven public investment. " +
    "Researchers recommend planting species that can survive future drought conditions and providing maintenance for young trees. " +
    "Without regular watering during their first years, many newly planted trees fail before delivering meaningful shade. " +
    "Community participation also helps cities choose planting locations that residents value and will protect. " +
    "A successful urban forestry program therefore combines environmental science, long-term funding, and local knowledge. " +
    "Measuring canopy growth over decades lets officials determine whether these programs actually reduce heat exposure."
  );

  const questions = window.QuizGenerator.generateQuiz(article, 3);
  assert.equal(questions.length, 3);
  for (const question of questions) {
    assert.equal(question.options.length, 4);
    assert.ok(question.options.includes(question.answer));
    assert.ok(question.evidence.includes(question.answer));
    assert.ok(question.prompt.includes("_____"));
    assert.ok(article.sentences.some((sentence) => sentence.id === question.sourceId));
  }
});

test("rejects pages with too little useful text", () => {
  const article = articleFrom("This is a short page.");
  assert.throws(() => window.QuizGenerator.generateQuiz(article, 3), /enough article-like text/);
});
