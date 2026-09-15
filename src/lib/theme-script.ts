/**
 * Server-safe theme constants. Kept out of any "use client" module: a server component that imports
 * a string from a client module receives a client reference, not the string.
 */
export const THEME_STORAGE_KEY = "quickbite.theme";

/**
 * Runs before first paint so the stored theme applies without a flash. Dark is the brand default;
 * light is opt-in and remembered.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
