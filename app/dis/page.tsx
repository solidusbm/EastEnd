import Link from "next/link";
import { readStore } from "@/lib/store";
import ThemeToggle from "../ThemeToggle";

export const dynamic = "force-dynamic";

// Intentionally public -- no admin auth (see proxy.ts's matcher). Anyone
// with this URL can see the list of screens, same as anyone with a single
// screen's own /dis/[screenId] URL already could. Meant for TVs/staff to
// pick a screen without needing a screen id memorized or an admin login.
export default async function DisplayIndexPage() {
  const { screens } = await readStore();
  const sorted = [...screens].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Select a screen
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Pick which screen this display should show.
      </p>

      {sorted.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No screens have been created yet — add one from <code>/admin</code>.
        </p>
      ) : (
        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((screen) => (
            <Link
              key={screen.id}
              href={`/dis/${screen.id}`}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-center text-lg font-medium text-zinc-900 shadow-sm hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {screen.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
