import { APPLICATION_NAME } from "@inventory-app/shared";

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Gestión de inventarios y ventas
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {APPLICATION_NAME}
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-300">
          La aplicación comercial está preparada para comenzar su desarrollo.
        </p>
      </section>
    </main>
  );
}
