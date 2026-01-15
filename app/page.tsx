import IngressLink from "@/components/IngressLink";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          Fitness Habit Tracker
        </h1>

        <p className="mt-3 max-w-xl text-sm text-slate-400">
          Track daily habits across multiple categories using a 
          circular grid in 8 week rounds. Start by setting up people and categories, then jump
          into a person’s active round.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <IngressLink
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Admin
          </IngressLink>

          <IngressLink
            href="/people"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            People
          </IngressLink>
        </div>
      </div>
    </main>
  );
}
