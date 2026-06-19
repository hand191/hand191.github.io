const THEME_KEY = "family-theme";
const themeButton = document.querySelector("#themeButton");

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);

  if (savedTheme) {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (!themeButton) {
    return;
  }

  themeButton.textContent = theme === "dark" ? "日间" : "夜间";
  themeButton.setAttribute("aria-pressed", String(theme === "dark"));
}

applyTheme(getInitialTheme());

themeButton?.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});
