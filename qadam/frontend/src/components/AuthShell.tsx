import BrandLogo from "@/components/BrandLogo";

/**
 * Split-screen auth chrome: philanthropic imagery + frosted form card.
 */
export default function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-emerald-950 lg:block">
        <img
          src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=70&auto=format"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-teal-900/75 to-slate-950/90" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <BrandLogo inverted to="/" />
          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Every step builds community impact
            </h1>
            <p className="text-sm leading-relaxed text-emerald-100/90">
              Match with trusted NGOs, verify attendance with QR, and see the
              hours that become real change.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-white/15 backdrop-blur-sm">
                2,400+ volunteers
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-white/15 backdrop-blur-sm">
                Verified hours
              </span>
            </div>
          </div>
          <p className="text-xs text-emerald-200/70">Qadam — civic tech for good</p>
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50/80 px-4 py-10">
        <div className="mb-8 lg:hidden">
          <BrandLogo />
        </div>
        {(title || subtitle) && (
          <div className="mb-6 max-w-md text-center">
            {title && <h1 className="qadam-section-title text-2xl">{title}</h1>}
            {subtitle && <p className="qadam-section-sub mt-2">{subtitle}</p>}
          </div>
        )}
        <div className="qadam-card w-full max-w-md border-emerald-100/80 bg-white/90 p-6 shadow-md backdrop-blur-md sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
