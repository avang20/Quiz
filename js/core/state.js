export const DEFAULT_STATE = {
    username: "بازیکن مهمان",
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    generalStage: 1,
    funStage: 1,
    completedGeneralStages: [],
    completedFunStages: [],
    stageScoresGeneral: {},
    stageScoresFun: {},
    hearts: 5,
    bestCombo: 0,
    dailyLoginRewardDate: null,
    dailyLoginRewardDay: 0,
    dailyLoginRewardXP: 0,
    maxHearts: 5,
    theme: "light",
    subscription: "free",
    subscriptionStatus: "inactive",
    subscriptionPlan: "",
    subscriptionName: "",
    subscriptionExpiry: null,
    subscriptionStart: null,
    premiumActive: false,
    subscriptionInfo: {
        active: false,
        planId: "",
        planName: "",
        start: null,
        expiry: null
    },
    welcomeSeen: false,
    registrationCelebrationSeen: false,
    subscriptionCelebrationSeen: false
};

export function createDefaultState() {
    return structuredClone(DEFAULT_STATE);
}

export function calculateLevel(xp) {
    return Math.floor(Number(xp || 0) / 100) + 1;
}

export function addXP(state, amount) {
    state.xp = Number(state.xp || 0) + Number(amount || 0);
    state.level = calculateLevel(state.xp);
}

export function getUnlockedStage(state, category) {
    return category === "general"
        ? Number(state.generalStage || 1)
        : Number(state.funStage || 1);
}

export function isStageCompleted(state, category, stage) {
    const list =
        category === "general"
            ? state.completedGeneralStages
            : state.completedFunStages;

    return Array.isArray(list) && list.includes(Number(stage));
}

export function markStageCompleted(state, category, stage) {
    const numericStage = Number(stage) || 1;
    const key =
        category === "general"
            ? "completedGeneralStages"
            : "completedFunStages";

    if (!Array.isArray(state[key])) {
        state[key] = [];
    }

    if (!state[key].includes(numericStage)) {
        state[key].push(numericStage);
        state[key].sort((a, b) => a - b);
    }

    const nextStage = numericStage + 1;

    if (category === "general") {
        state.generalStage = Math.max(
            Number(state.generalStage || 1),
            nextStage
        );
    } else {
        state.funStage = Math.max(
            Number(state.funStage || 1),
            nextStage
        );
    }
}
