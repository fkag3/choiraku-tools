"use strict";

/*
 * 日数・営業日計算ツール
 *
 * calendar: 通常の日数（土日・祝日を含む）
 * business: 営業日数（土日・日本の祝日を除く）
 *
 * 祝日データ:
 * Nager.Date Public Holidays API
 */

const HOLIDAY_API_BASE = "https://date.nager.at/api/v3/PublicHolidays/";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 同じ年の祝日データを何度も取得しないためのキャッシュ
const holidayCache = new Map();

// HTML要素
const modeInputs = document.querySelectorAll(
    'input[name="calculation-mode"]'
);

const holidayStatus = document.getElementById("holiday-status");

const differenceForm = document.getElementById("difference-form");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const differenceResult = document.getElementById("difference-result");

const additionForm = document.getElementById("addition-form");
const baseDateInput = document.getElementById("base-date");
const dayCountInput = document.getElementById("day-count");
const additionResult = document.getElementById("addition-result");

const differenceButton = differenceForm.querySelector(
    'button[type="submit"]'
);

const additionButton = additionForm.querySelector(
    'button[type="submit"]'
);

/*
 * YYYY-MM-DD形式の日付をUTCの日付として読み込む。
 * 存在しない日付や形式が違う値はnullを返す。
 */
function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);

    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
}

/*
 * DateをYYYY-MM-DD形式に変換する。
 */
function toDateString(date) {
    const year = String(date.getUTCFullYear()).padStart(4, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

/*
 * 日付を日本語で表示する。
 */
function formatDate(date) {
    return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "UTC"
    }).format(date);
}

/*
 * 選択されている計算方法を取得する。
 */
function getCalculationMode() {
    const selected = document.querySelector(
        'input[name="calculation-mode"]:checked'
    );

    return selected ? selected.value : "calendar";
}

/*
 * 祝日データの取得状況を表示する。
 */
function setHolidayStatus(message, state = "default") {
    holidayStatus.textContent = message;

    if (state === "default") {
        delete holidayStatus.dataset.state;
    } else {
        holidayStatus.dataset.state = state;
    }
}

/*
 * 計算結果を表示する。
 */
function showResult(element, message, state = "default") {
    element.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    element.appendChild(paragraph);

    if (state === "default") {
        delete element.dataset.state;
    } else {
        element.dataset.state = state;
    }
}

/*
 * 計算結果の中に、強調する数値や日付を表示する。
 * HTML文字列を直接挿入せず、DOM要素を作成する。
 */
function showDetailedResult(element, label, value, detail = "") {
    element.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.append(document.createTextNode(`${label}：`));

    const strong = document.createElement("strong");
    strong.textContent = value;

    paragraph.appendChild(strong);
    element.appendChild(paragraph);

    if (detail) {
        const detailParagraph = document.createElement("p");
        detailParagraph.textContent = detail;
        element.appendChild(detailParagraph);
    }

    element.dataset.state = "success";
}

/*
 * エラーを表示する。
 */
function showError(element, message) {
    showResult(element, message, "error");
}

/*
 * 指定した年の日本の祝日データを取得する。
 *
 * APIのレスポンス例:
 * [
 *   {
 *     "date": "2026-01-01",
 *     "localName": "元日",
 *     "name": "New Year's Day"
 *   }
 * ]
 */
async function loadHolidays(year) {
    if (holidayCache.has(year)) {
        return holidayCache.get(year);
    }

    const request = (async () => {
        const response = await fetch(
            `${HOLIDAY_API_BASE}${year}/JP`
        );

        if (!response.ok) {
            throw new Error(
                `${year}年の祝日データを取得できませんでした。`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("祝日データの形式が正しくありません。");
        }

        const holidays = new Set();

        for (const item of data) {
            if (
                item &&
                typeof item.date === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
                item.date.startsWith(`${year}-`)
            ) {
                holidays.add(item.date);
            }
        }

        // 年によって祝日数は変わるため、件数を固定条件にしない。
        // 空配列もAPIの正しいレスポンスとして扱う。
        return holidays;
    })();

    holidayCache.set(year, request);

    try {
        return await request;
    } catch (error) {
        // 失敗したリクエストをキャッシュに残さず、再試行可能にする。
        holidayCache.delete(year);
        throw error;
    }
}

/*
 * 指定した期間に含まれる祝日データを取得する。
 */
async function loadHolidayRange(startYear, endYear) {
    const allHolidays = new Set();

    for (let year = startYear; year <= endYear; year += 1) {
        const holidays = await loadHolidays(year);

        for (const holiday of holidays) {
            allHolidays.add(holiday);
        }
    }

    return allHolidays;
}

/*
 * 指定した日付が営業日かどうかを判定する。
 * 土曜日・日曜日・祝日は営業日ではない。
 */
function isBusinessDay(date, holidays) {
    const dayOfWeek = date.getUTCDay();

    // 0 = 日曜日、6 = 土曜日
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
    }

    return !holidays.has(toDateString(date));
}

/*
 * 日付を1日進める。
 */
function moveDate(date, amount) {
    const nextDate = new Date(date.getTime());
    nextDate.setUTCDate(nextDate.getUTCDate() + amount);

    return nextDate;
}

/*
 * 計算方法の選択に応じて説明を更新する。
 */
function updateModeDescription() {
    const mode = getCalculationMode();

    if (mode === "calendar") {
        setHolidayStatus(
            "通常の日数を計算します。土日・祝日も日数に含まれます。"
        );
    } else {
        setHolidayStatus(
            "営業日数を計算します。土日・日本の祝日を除外します。"
        );
    }

    showResult(
        differenceResult,
        "開始日と終了日を入力してください。"
    );

    showResult(
        additionResult,
        "基準日と日数を入力してください。"
    );
}

/*
 * 計算方法が変更されたときの処理。
 */
modeInputs.forEach((input) => {
    input.addEventListener("change", updateModeDescription);
});

/*
 * 2つの日付の間の日数を計算する。
 *
 * 通常の日数:
 * 開始日と終了日の両方を含む。
 *
 * 営業日数:
 * 開始日と終了日の両方を対象にし、
 * 土日と祝日を除いて数える。
 */
differenceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mode = getCalculationMode();

    const startDate = parseDate(startDateInput.value);
    const endDate = parseDate(endDateInput.value);

    if (!startDate || !endDate) {
        showError(
            differenceResult,
            "開始日と終了日の両方を正しく入力してください。"
        );
        return;
    }

    if (startDate.getTime() > endDate.getTime()) {
        showError(
            differenceResult,
            "開始日は終了日以前の日付を指定してください。"
        );
        return;
    }

    const calendarDays =
        Math.round(
            (endDate.getTime() - startDate.getTime()) / MS_PER_DAY
        ) + 1;

    // 過度に長い期間による大量の計算やAPIアクセスを防ぐ。
    if (calendarDays > 3660) {
        showError(
            differenceResult,
            "計算できる期間は最大10年程度です。日付を短い範囲にしてください。"
        );
        return;
    }

    if (mode === "calendar") {
        showDetailedResult(
            differenceResult,
            "通常の日数",
            `${calendarDays}日`,
            `${formatDate(startDate)} ～ ${formatDate(endDate)}（両端を含む）`
        );

        return;
    }

    differenceButton.disabled = true;

    showResult(
        differenceResult,
        "祝日データを取得して営業日数を計算しています..."
    );

    setHolidayStatus(
        "祝日データを取得しています。しばらくお待ちください。",
        "loading"
    );

    try {
        const holidays = await loadHolidayRange(
            startDate.getUTCFullYear(),
            endDate.getUTCFullYear()
        );

        let businessDays = 0;
        let currentDate = new Date(startDate.getTime());

        while (currentDate.getTime() <= endDate.getTime()) {
            if (isBusinessDay(currentDate, holidays)) {
                businessDays += 1;
            }

            currentDate = moveDate(currentDate, 1);
        }

        showDetailedResult(
            differenceResult,
            "営業日数",
            `${businessDays}営業日`,
            `${formatDate(startDate)} ～ ${formatDate(endDate)}（土日・祝日を除外）`
        );

        setHolidayStatus(
            "祝日データを取得しました。営業日数の計算が完了しました。",
            "success"
        );
    } catch (error) {
        console.error("営業日数の計算に失敗しました:", error);

        showError(
            differenceResult,
            "祝日データを取得できなかったため、営業日数を計算できませんでした。インターネット接続を確認して、もう一度お試しください。"
        );

        setHolidayStatus(
            "祝日データを取得できませんでした。時間をおいて再度お試しください。",
            "error"
        );
    } finally {
        differenceButton.disabled = false;
    }
});

/*
 * 指定した日数後・前の日付を計算する。
 *
 * 通常の日数:
 * カレンダー上で日数分進める、または戻す。
 *
 * 営業日数:
 * 基準日は数えず、翌日または前日から数える。
 * 土日と祝日はカウントしない。
 */
additionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mode = getCalculationMode();

    const baseDate = parseDate(baseDateInput.value);
    const dayCount = Number(dayCountInput.value);

    if (!baseDate) {
        showError(
            additionResult,
            "基準日を正しく入力してください。"
        );
        return;
    }

    if (
        dayCountInput.value.trim() === "" ||
        !Number.isInteger(dayCount) ||
        dayCount < -5000 ||
        dayCount > 5000
    ) {
        showError(
            additionResult,
            "日数は -5000 から 5000 までの整数で入力してください。"
        );
        return;
    }

    if (dayCount === 0) {
        showDetailedResult(
            additionResult,
            "計算結果",
            formatDate(baseDate),
            "0日なので、基準日と同じ日付です。"
        );

        if (mode === "business") {
            setHolidayStatus(
                "基準日と同じ日付を表示しました。今回は祝日データの取得は不要です。"
            );
        }

        return;
    }

    // 通常の日数では、土日・祝日を含めて日付を計算する。
    if (mode === "calendar") {
        const resultDate = moveDate(baseDate, dayCount);

        showDetailedResult(
            additionResult,
            "計算結果",
            formatDate(resultDate),
            `基準日 ${formatDate(baseDate)} から ${Math.abs(dayCount)}日${dayCount > 0 ? "後" : "前"}`
        );

        return;
    }

    // 営業日計算では、祝日データを取得する。
    additionButton.disabled = true;

    showResult(
        additionResult,
        "祝日データを確認しながら営業日を計算しています..."
    );

    setHolidayStatus(
        "祝日データを取得しています。しばらくお待ちください。",
        "loading"
    );

    try {
        const direction = dayCount > 0 ? 1 : -1;
        const targetBusinessDays = Math.abs(dayCount);

        let resultDate = new Date(baseDate.getTime());
        let countedBusinessDays = 0;

        // 基準日は数えず、翌日または前日から開始する。
        while (countedBusinessDays < targetBusinessDays) {
            resultDate = moveDate(resultDate, direction);

            const year = resultDate.getUTCFullYear();
            const holidays = await loadHolidays(year);

            if (isBusinessDay(resultDate, holidays)) {
                countedBusinessDays += 1;
            }
        }

        showDetailedResult(
            additionResult,
            "計算結果",
            formatDate(resultDate),
            `基準日 ${formatDate(baseDate)} から ${targetBusinessDays}営業日${direction > 0 ? "後" : "前"}`
        );

        setHolidayStatus(
            "祝日データを取得しました。営業日の計算が完了しました。",
            "success"
        );
    } catch (error) {
        console.error("営業日の加算・減算に失敗しました:", error);

        showError(
            additionResult,
            "祝日データを取得できなかったため、営業日を計算できませんでした。インターネット接続を確認して、もう一度お試しください。"
        );

        setHolidayStatus(
            "祝日データを取得できませんでした。時間をおいて再度お試しください。",
            "error"
        );
    } finally {
        additionButton.disabled = false;
    }
});

/*
 * フッターの年を自動設定する。
 */
const currentYearElement = document.getElementById("current-year");

if (currentYearElement) {
    currentYearElement.textContent = new Date().getFullYear();
}

/*
 * ページ表示時の初期設定。
 */
updateModeDescription();