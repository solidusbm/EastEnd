"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  // Matches the default the beforeInteractive script in layout.tsx applies,
  // so the server-rendered and pre-effect client-rendered label agree (no
  // hydration mismatch); corrected below once mounted, in case the actual
  // class differs (a stored "light" preference).
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Synchronizing from the DOM class the beforeInteractive script set (a
    // browser API, not React state/props) is exactly what an effect is for;
    // this isn't the derived-state antipattern the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage unavailable (e.g. private browsing) -- toggle still
      // works for this page load, just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
