
/* ========================================
   ちょいラク工具箱 - 文字数カウンター
   ======================================== */

const textInput = document.getElementById("text-input");

const countAll = document.getElementById("count-all");
const countNoWhitespace = document.getElementById("count-no-whitespace");
const countWhitespace = document.getElementById("count-whitespace");
const countLines = document.getElementById("count-lines");
const countManuscript = document.getElementById("count-manuscript");

const inputStatus = document.getElementById("input-status");
const copyButton = document.getElementById("copy-button");
const clearButton = document.getElementById("clear-button");
const currentYear = document.getElementById("current-year");

// 対応ブラウザでは、絵文字なども画面上の文字単位で数える
const characterSegmenter =
    typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter("ja", { granularity: "grapheme" })
        : null;

/**
 * 文字列の文字数を数える
 */
function countCharacters(text) {
    if (characterSegmenter) {
        return Array.from(characterSegmenter.segment(text)).length;
    }

    // 古いブラウザ向けの代替処理
    return Array.from(text).length;
}

/**
 * 入力内容から各種カウントを更新する
 */
function updateCounts() {
    const text = textInput.value;

    // 空白・改行も含めた文字数
    const total = countCharacters(text);

    // 空白文字をすべて取り除いた文字数
    const withoutWhitespace = countCharacters(
        text.replace(/\s/gu, "")
    );

    const whitespace = total - withoutWhitespace;

    // 空欄なら0行、入力があれば改行数に応じて計算
    const lines = text.length === 0
        ? 0
        : text.split(/\r\n|\r|\n/).length;

    // 400字詰め原稿用紙に換算した目安
    const manuscriptPages = total === 0
        ? 0
        : Math.ceil(total / 400);

    countAll.textContent = total.toLocaleString("ja-JP");
    countNoWhitespace.textContent =
        withoutWhitespace.toLocaleString("ja-JP");
    countWhitespace.textContent =
        whitespace.toLocaleString("ja-JP");
    countLines.textContent = lines.toLocaleString("ja-JP");
    countManuscript.textContent =
        manuscriptPages.toLocaleString("ja-JP");

    inputStatus.textContent = text.length === 0
        ? "文章を入力してください"
        : `${total.toLocaleString("ja-JP")}文字をカウント中`;
}

/**
 * 文章をクリップボードにコピーする
 */
async function copyText() {
    const text = textInput.value;

    if (!text) {
        inputStatus.textContent = "コピーする文章がありません";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        inputStatus.textContent = "文章をコピーしました";
    } catch {
        // Clipboard APIが使えない環境向けの代替処理
        textInput.focus();
        textInput.select();

        const copied = document.execCommand("copy");

        // 選択状態を解除
        textInput.setSelectionRange(text.length, text.length);

        inputStatus.textContent = copied
            ? "文章をコピーしました"
            : "コピーできませんでした。文章を選択して手動でコピーしてください";
    }
}

/**
 * 入力内容を消去する
 */
function clearText() {
    textInput.value = "";
    updateCounts();
    textInput.focus();
}

/* イベント登録 */

textInput.addEventListener("input", updateCounts);
copyButton.addEventListener("click", copyText);
clearButton.addEventListener("click", clearText);

// フッターの年を更新
if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

// 初期表示
updateCounts();
