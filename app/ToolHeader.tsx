import Link from "next/link";

export function ToolHeader({ active }: { active: "planner" | "paldex" | "calculator" }) {
  return <header className="topbar tool-topbar">
    <Link className="brand" href="/" aria-label="返回育种规划主页">
      <span className="brand-mark">P</span>
      <span><strong>帕鲁育种实验室</strong><small>PAL GENETICS · 1.0</small></span>
    </Link>
    <nav className="topnav" aria-label="主导航">
      <Link className={active === "planner" ? "active" : ""} href="/">育种规划</Link>
      <Link className={active === "paldex" ? "active" : ""} href="/paldex">完整图鉴</Link>
      <Link className={active === "calculator" ? "active" : ""} href="/calculator">配种计算器</Link>
    </nav>
    <div className="tool-version">PALWORLD 1.0</div>
  </header>;
}
