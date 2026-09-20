const STATE_PREFIX = "quizduo_state_";
const USERS_KEY = "quizduo_users";
const CURRENT_USER_KEY = "quizduo_current_user";
const LEADERBOARD_KEY = "quizduo_leaderboard";

function userKey(username) {
    return (
        STATE_PREFIX +
        encodeURIComponent(
            String(username || "guest").toLowerCase()
        )
    );
}

function normalizeStageScoreMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    const result = {};
    Object.entries(value).forEach(([stage, score]) => {
        const numeric = Number(score);
        if (Number.isFinite(numeric)) {
            result[String(stage)] = Math.max(0, Math.min(1, numeric));
        }
    });
    return result;
}

export function loadState(defaultState, username = "guest") {
    try {
        const saved = localStorage.getItem(userKey(username));

        if (!saved) {
            return structuredClone(defaultState);
        }

        const parsed = JSON.parse(saved);
        const base = structuredClone(defaultState);

        return {
            ...base,
            ...parsed,
            completedGeneralStages:
                Array.isArray(parsed.completedGeneralStages)
                    ? parsed.completedGeneralStages.map(Number)
                    : [],
            completedFunStages:
                Array.isArray(parsed.completedFunStages)
                    ? parsed.completedFunStages.map(Number)
                    : [],
            stageScoresGeneral:
                normalizeStageScoreMap(parsed.stageScoresGeneral),
            stageScoresFun:
                normalizeStageScoreMap(parsed.stageScoresFun),
            subscriptionInfo:
                parsed.subscriptionInfo &&
                typeof parsed.subscriptionInfo === "object"
                    ? parsed.subscriptionInfo
                    : base.subscriptionInfo,
            welcomeSeen:
                parsed.welcomeSeen === true
        };
    } catch (error) {
        console.error("QuizDuo state error:", error);
        return structuredClone(defaultState);
    }
}

export function saveState(state, username = state.username || "guest") {
    try {
        localStorage.setItem(
            userKey(username),
            JSON.stringify(state)
        );
        return true;
    } catch (error) {
        console.error("Could not save state:", error);
        return false;
    }
}

export function getCurrentUser() {
    return localStorage.getItem(CURRENT_USER_KEY) || null;
}

export function setCurrentUser(username) {
    localStorage.setItem(CURRENT_USER_KEY, username);
}

export function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}

export function getUsers() {
    try {
        const users = JSON.parse(
            localStorage.getItem(USERS_KEY) || "[]"
        );
        return Array.isArray(users) ? users : [];
    } catch {
        return [];
    }
}

export function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getLeaderboard() {
    try {
        const board = JSON.parse(
            localStorage.getItem(LEADERBOARD_KEY) || "[]"
        );
        return Array.isArray(board) ? board : [];
    } catch {
        return [];
    }
}

export function updateLeaderboard(state) {
    if (
        !state.username ||
        state.username === "بازیکن مهمان"
    ) {
        return;
    }

    const username = String(state.username);
    const key = username.toLowerCase();

    const board = getLeaderboard().filter(
        item =>
            String(item.username || "").toLowerCase() !== key
    );

    board.push({
        username,
        xp: Number(state.xp || 0),
        level: Number(state.level || 1),
        generalStage: Number(state.generalStage || 1),
        funStage: Number(state.funStage || 1),
        updatedAt: Date.now()
    });

    board.sort(
        (a, b) =>
            Number(b.xp || 0) - Number(a.xp || 0) ||
            Number(b.level || 1) - Number(a.level || 1) ||
            Number(b.updatedAt || 0) - Number(a.updatedAt || 0)
    );

    localStorage.setItem(
        LEADERBOARD_KEY,
        JSON.stringify(board.slice(0, 100))
    );
}
