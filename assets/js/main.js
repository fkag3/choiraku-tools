
/* ========================================
   ちょいラク工具箱 - トップページの動作
   ======================================== */

const searchInput = document.getElementById("tool-search");
const toolCards = Array.from(
    document.querySelectorAll(".tool-card")
);
const emptyMessage = document.getElementById("empty-message");
const currentYear = document.getElementById("current-year");

/**
 * 検索キーワードに合うツールだけを表示する
 */
function filterTools() {
    const keyword = searchInput.value
        .trim()
        .toLocaleLowerCase("ja");

    let visibleCount = 0;

    toolCards.forEach((card) => {
        const title = card.querySelector(".tool-card-title").textContent;
        const description = card.querySelector(
            ".tool-card-description"
        ).textContent;
        const keywords = card.dataset.search || "";

        const searchableText = [
            title,
            description,
            keywords
        ].join(" ").toLocaleLowerCase("ja");

        const matches = searchableText.includes(keyword);

        card.hidden = !matches;

        if (matches) {
            visibleCount += 1;
        }
    });

    emptyMessage.hidden = visibleCount !== 0;
}

/**
 * フッターに現在の年を表示する
 */
function updateCurrentYear() {
    currentYear.textContent = new Date().getFullYear();
}

/* イベント登録と初期化 */

searchInput.addEventListener("input", filterTools);

updateCurrentYear();
