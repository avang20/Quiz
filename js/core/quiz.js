import { shuffle } from "./utils.js";
import {
    addXP,
    markStageCompleted,
    isStageCompleted
} from "./state.js";


export const QUIZ_CONFIG = {
    defaultQuestionsPerStage: 10,
    reserveQuestions: 5,
    passingPercentage: 0.75,
    questionTime: 20,
    stageXP: 10,
    failedStageHeartPenalty: 1
};


function normalizeQuestion(raw, fallbackStage = 1) {

    if (!raw || typeof raw !== "object") {
        return null;
    }

    let questionText =
        raw.question ??
        raw.questionText ??
        raw.q ??
        raw.text ??
        raw.title ??
        raw.prompt ??
        raw.content ??
        "";

    if (questionText && typeof questionText === "object") {
        questionText =
            questionText.text ??
            questionText.value ??
            questionText.title ??
            questionText.content ??
            "";
    }

    let rawOptions =
        raw.options ??
        raw.choices ??
        raw.answers ??
        raw.variants ??
        raw.o ??
        [];

    if (!Array.isArray(rawOptions)) {
        rawOptions = Object.values(rawOptions || {});
    }

    const options = rawOptions.map(option => {
        if (option && typeof option === "object") {
            return {
                text: String(
                    option.text ??
                    option.label ??
                    option.value ??
                    option.answer ??
                    option.content ??
                    ""
                )
            };
        }

        return {
            text: String(option ?? "")
        };
    });

    const rawAnswer =
        raw.answer ??
        raw.correctAnswer ??
        raw.correct_answer ??
        raw.correct ??
        raw.answerIndex ??
        raw.answer_index ??
        raw.correctIndex ??
        raw.correct_index ??
        raw.correctOption ??
        raw.correct_option;

    let correctIndex = -1;

    if (typeof rawAnswer === "number" && Number.isInteger(rawAnswer)) {
        if (rawAnswer >= 0 && rawAnswer < options.length) {
            correctIndex = rawAnswer;
        } else if (rawAnswer > 0 && rawAnswer <= options.length) {
            correctIndex = rawAnswer - 1;
        }
    } else if (typeof rawAnswer === "string") {
        const trimmed = rawAnswer.trim();
        const numeric = Number(trimmed);

        if (Number.isInteger(numeric)) {
            if (numeric >= 0 && numeric < options.length) {
                correctIndex = numeric;
            } else if (numeric > 0 && numeric <= options.length) {
                correctIndex = numeric - 1;
            }
        }

        if (correctIndex < 0 && /^[A-Za-z]$/.test(trimmed)) {
            const letterIndex =
                trimmed.toUpperCase().charCodeAt(0) - 65;

            if (letterIndex >= 0 && letterIndex < options.length) {
                correctIndex = letterIndex;
            }
        }

        if (correctIndex < 0) {
            correctIndex = options.findIndex(
                option =>
                    option.text.trim().toLocaleLowerCase() ===
                    trimmed.toLocaleLowerCase()
            );
        }
    } else if (rawAnswer && typeof rawAnswer === "object") {
        const candidate =
            rawAnswer.text ??
            rawAnswer.label ??
            rawAnswer.value ??
            rawAnswer.answer;

        if (candidate !== undefined) {
            correctIndex = options.findIndex(
                option =>
                    option.text.trim() === String(candidate).trim()
            );
        }
    }

    if (correctIndex < 0) {
        const correctOptions =
            raw.correctOptions ??
            raw.correct_options;

        if (Array.isArray(correctOptions) && correctOptions.length) {
            correctIndex = options.findIndex(
                option =>
                    option.text.trim() ===
                    String(correctOptions[0]).trim()
            );
        }
    }

    let shuffledOptions = options;

    if (correctIndex >= 0 && correctIndex < options.length) {
        shuffledOptions = shuffle(
            options.map((option, index) => ({
                ...option,
                isCorrect: index === correctIndex
            }))
        );
    } else {
        shuffledOptions = shuffle(options);
    }

    const newCorrectIndex =
        shuffledOptions.findIndex(
            option => option.isCorrect === true
        );

    const stage =
        Number(
            raw.stage ??
            raw.stageNumber ??
            raw.stage_number ??
            raw.level ??
            raw.levelNumber ??
            fallbackStage
        ) || fallbackStage;

    return {
        ...raw,
        stage,
        question: String(questionText ?? ""),
        q: String(questionText ?? ""),
        options: shuffledOptions.map(option => option.text),
        answer: newCorrectIndex,
        explanation: String(
            raw.explanation ??
            raw.explain ??
            raw.description ??
            ""
        )
    };
}


export class QuizEngine {

    constructor(state, saveState) {
        this.state = state;
        this.saveState =
            typeof saveState === "function"
                ? saveState
                : () => {};

        this.questions = [];
        this.selectedQuestions = [];
        this.currentQuestion = 0;
        this.currentCategory = "general";
        this.currentStage = 1;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.combo = 0;
        this.finished = false;
        this.isReplay = false;
        this.stageRewardGiven = false;
    }


    async loadCategory(category) {
        const safeCategory =
            category === "fun" ? "fun" : "general";

        const base =
            document.baseURI || window.location.href;

        const url =
            new URL(
                `data/${safeCategory}.json`,
                base
            );

        console.log(
            "Loading quiz data:",
            url.pathname
        );

        const response =
            await fetch(
                url.href,
                { cache: "no-store" }
            );

        if (!response.ok) {
            throw new Error(
                `Could not load ${url.pathname}`
            );
        }

        const data = await response.json();
        let rawQuestions = [];

        if (Array.isArray(data)) {
            rawQuestions = data;
        } else if (Array.isArray(data.questions)) {
            rawQuestions = data.questions;
        } else if (Array.isArray(data.items)) {
            rawQuestions = data.items;
        } else if (Array.isArray(data.stages)) {
            data.stages.forEach(stageBlock => {
                const stageNumber =
                    Number(
                        stageBlock.stage ??
                        stageBlock.id ??
                        1
                    ) || 1;

                const list =
                    Array.isArray(stageBlock.questions)
                        ? stageBlock.questions
                        : [];

                list.forEach(question => {
                    rawQuestions.push({
                        ...question,
                        stage:
                            question.stage ??
                            stageNumber
                    });
                });
            });
        }

        this.questions =
            rawQuestions
                .map(question =>
                    normalizeQuestion(
                        question,
                        1
                    )
                )
                .filter(question =>
                    question &&
                    question.question.trim() &&
                    question.options.length >= 2 &&
                    question.answer >= 0 &&
                    question.answer < question.options.length
                );

        this.currentCategory = safeCategory;

        console.log(
            `Loaded ${this.questions.length} ${safeCategory} questions`
        );

        return this.questions;
    }


    getStageQuestions(stage) {
        return this.questions.filter(
            question =>
                Number(question.stage) ===
                Number(stage)
        );
    }


    getQuestionsForThisRound(stage) {
        const stageQuestions =
            this.getStageQuestions(stage);

        if (
            stageQuestions.length <=
            QUIZ_CONFIG.defaultQuestionsPerStage
        ) {
            return shuffle(stageQuestions);
        }

        const count =
            stageQuestions.length -
            QUIZ_CONFIG.reserveQuestions;

        return shuffle(stageQuestions).slice(0, count);
    }


    startStage(category, stage, replay = false) {
        this.currentCategory = category;
        this.currentStage = Number(stage) || 1;
        this.isReplay = Boolean(replay);
        this.currentQuestion = 0;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.combo = 0;
        this.finished = false;
        this.stageRewardGiven = false;

        this.selectedQuestions =
            this.getQuestionsForThisRound(
                this.currentStage
            );

        console.log(
            "Starting stage:",
            this.currentStage,
            "total stage questions:",
            this.getStageQuestions(this.currentStage).length,
            "questions this round:",
            this.selectedQuestions.length
        );

        return this.selectedQuestions;
    }


    getCurrentQuestion() {
        return (
            this.selectedQuestions[
                this.currentQuestion
            ] || null
        );
    }


    getQuestionCount() {
        return this.selectedQuestions.length;
    }


    answer(answerIndex, timedOut = false) {
        const question = this.getCurrentQuestion();

        if (!question) {
            return {
                finished: true,
                correct: false,
                passed: false,
                total: this.selectedQuestions.length
            };
        }

        const correct =
            !timedOut &&
            Number(answerIndex) ===
                Number(question.answer);

        if (correct) {
            this.correctAnswers++;
            this.combo++;
            this.state.bestCombo = Math.max(
                Number(this.state.bestCombo || 0),
                this.combo
            );
        } else {
            this.wrongAnswers++;
            this.combo = 0;
        }

        this.currentQuestion++;

        const finished =
            this.currentQuestion >=
            this.selectedQuestions.length;

        let passed = false;
        let earnedXP = 0;
        let heartLost = false;
        let newlyCompleted = false;

        if (finished) {
            const percentage =
                this.selectedQuestions.length
                    ? this.correctAnswers /
                      this.selectedQuestions.length
                    : 0;

            passed =
                percentage >=
                QUIZ_CONFIG.passingPercentage;

            const scoreKey =
                this.currentCategory === "general"
                    ? "stageScoresGeneral"
                    : "stageScoresFun";

            if (!this.state[scoreKey] || typeof this.state[scoreKey] !== "object") {
                this.state[scoreKey] = {};
            }

            const stageKey = String(this.currentStage);
            const previousBest =
                Number(this.state[scoreKey][stageKey] || 0);

            if (percentage > previousBest) {
                this.state[scoreKey][stageKey] = percentage;
            }

            if (passed) {
                const alreadyCompleted =
                    isStageCompleted(
                        this.state,
                        this.currentCategory,
                        this.currentStage
                    );

                if (
                    !this.isReplay &&
                    !alreadyCompleted
                ) {
                    addXP(
                        this.state,
                        QUIZ_CONFIG.stageXP
                    );

                    earnedXP =
                        QUIZ_CONFIG.stageXP;

                    markStageCompleted(
                        this.state,
                        this.currentCategory,
                        this.currentStage
                    );

                    newlyCompleted = true;
                    this.stageRewardGiven = true;
                }
            } else if (!this.isReplay) {
                const infiniteHeartsActive =
                    Number(this.state.infiniteHeartsUntil || 0) > Date.now();

                if (!infiniteHeartsActive && Number(this.state.hearts) > 0) {
                    this.state.hearts = Math.max(
                        0,
                        Number(this.state.hearts) -
                            QUIZ_CONFIG.failedStageHeartPenalty
                    );

                    if (Number(this.state.hearts) > 0 && !this.state.heartRefillAt) {
                        this.state.heartRefillAt = Date.now() + 20 * 60 * 1000;
                    } else if (Number(this.state.hearts) === 0 && !this.state.heartRefillAt) {
                        this.state.heartRefillAt = Date.now() + 20 * 60 * 1000;
                    }

                    heartLost = true;
                }
            }
        }

        this.finished = finished;
        this.saveState(this.state);

        return {
            correct,
            timedOut: Boolean(timedOut),
            finished,
            passed,
            earnedXP,
            heartLost,
            newlyCompleted,
            replay: this.isReplay,
            combo: this.combo,
            correctAnswers: this.correctAnswers,
            wrongAnswers: this.wrongAnswers,
            total: this.selectedQuestions.length,
            percentage:
                this.selectedQuestions.length
                    ? this.correctAnswers /
                      this.selectedQuestions.length
                    : 0,
            explanation: ""
        };
    }
}


export default {
    QuizEngine,
    QUIZ_CONFIG
};
