// Applies the saved theme before first paint to avoid a flash. Kept as a file, not an inline script, so the
// Content-Security-Policy can forbid inline scripts. Keep in sync with src/state/ThemeContext.tsx.
;(function () {
  var mode = localStorage.getItem('opamp.theme') || 'system'
  var dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
