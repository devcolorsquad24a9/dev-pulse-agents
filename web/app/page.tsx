import { NewsletterForm } from "@/components/newsletter-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-16">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))]">
          MVP: IDEs • Monthly
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          Dev Pulse — tool updates + comparison digest
        </h1>
        <p className="max-w-2xl text-pretty text-base text-[hsl(var(--muted-foreground))] md:text-lg">
          A newsletter product where an agent pipeline tracks what changed across top IDEs,
          compares tradeoffs (pros/cons), pulls in non-vendor sources, and sends a clean
          “who it’s for” recommendation.
        </p>
      </header>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">What you’ll get</h2>
          <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
            <li>
              <span className="font-medium text-[hsl(var(--foreground))]">Updates</span>{" "}
              from official release notes and changelogs.
            </li>
            <li>
              <span className="font-medium text-[hsl(var(--foreground))]">
                De-biased signals
              </span>{" "}
              from credible third-party sources (when relevant).
            </li>
            <li>
              <span className="font-medium text-[hsl(var(--foreground))]">Comparison</span>{" "}
              using a consistent rubric (performance, stability, ecosystem, pricing).
            </li>
            <li>
              <span className="font-medium text-[hsl(var(--foreground))]">
                Recommendation
              </span>{" "}
              like “If you’re X, pick Y” with caveats.
            </li>
          </ul>

          <div className="rounded-lg border border-[hsl(var(--border))] p-4">
            <h3 className="text-sm font-semibold">Current scope</h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              IDEs only to start (e.g., VS Code, JetBrains, Cursor, Visual Studio, Neovim/Zed).
              Once it’s stable, we’ll expand categories and personalization.
            </p>
          </div>
        </div>

        <div>
          <NewsletterForm />
        </div>
      </section>

      <footer className="mt-16 border-t border-[hsl(var(--border))] pt-6 text-xs text-[hsl(var(--muted-foreground))]">
        Built with Next.js on Vercel.
      </footer>
    </main>
  );
}


