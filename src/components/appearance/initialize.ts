/** Apply the saved interface palette before paint. Never touches editor drafts. */
export const themeInitializer = '(function(){try{document.documentElement.dataset.theme=localStorage.getItem("mantora:appearance:v1") === "dark" ? "dark" : "light"}catch(e){document.documentElement.dataset.theme="light"}})();';
