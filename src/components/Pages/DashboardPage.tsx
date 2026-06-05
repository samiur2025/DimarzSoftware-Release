import React from "react";
interface Props {
className: string;
}
const DashboardPage: React.FC<Props> = ({ className }) => {
return (
<div className={className} id="dashboardPage">
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 24 }}>
<div className="card">
<div className="card-header">
<span className="card-title">Total Prospects</span>
<div className="card-icon red">👥</div>
</div>
<div className="card-value" style={{ color: "var(--accent-red)" }}>10,000,000</div>
<div className="card-change">+12.5% from last month</div>
</div>
<div className="card">
<div className="card-header">
<span className="card-title">New This Week</span>
<div className="card-icon blue">📈</div>
</div>
<div className="card-value" style={{ color: "var(--info)" }}>24,580</div>
<div className="card-change">+8.3% from last week</div>
</div>
<div className="card">
<div className="card-header">
<span className="card-title">Conversion Rate</span>
<div className="card-icon green">🎯</div>
</div>
<div className="card-value" style={{ color: "var(--success)" }}>7.5%</div>
<div className="card-change">+2.1% from last month</div>
</div>
<div className="card">
<div className="card-header">
<span className="card-title">Revenue Potential</span>
<div className="card-icon yellow">💰</div>
</div>
<div className="card-value" style={{ color: "var(--warning)" }}>$2.4B</div>
<div className="card-change">+15.2% from last quarter</div>
</div>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
<div className="card" style={{ gridColumn: "span 2" }}>
<div className="card-header">
<span className="card-title">Top Industries</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
{[
{ name: "Technology", width: "85%", count: "3.2M", color: "var(--accent-red)" },
{ name: "Healthcare", width: "65%", count: "2.1M", color: "var(--info)" },
{ name: "Finance", width: "55%", count: "1.9M", color: "var(--success)" },
{ name: "Retail", width: "45%", count: "1.5M", color: "var(--warning)" },
].map(ind => (
<div key={ind.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
<span style={{ width: 100, fontSize: 13 }}>{ind.name}</span>
<div style={{ flex: 1, height: 8, background: "var(--bg-hover)", borderRadius: 4, overflow: "hidden" }}>
<div style={{ width: ind.width, height: "100%", background: ind.color, borderRadius: 4 }}></div>
</div>
<span style={{ width: 60, textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>{ind.count}</span>
</div>
))}
</div>
</div>
<div className="card" style={{ gridColumn: "span 2" }}>
<div className="card-header">
<span className="card-title">Recent Activity</span>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
{[
{ icon: "📥", bg: "var(--accent-red-dim)", title: "Imported 50,000 new leads", time: "2 hours ago" },
{ icon: "✅", bg: "rgba(34,197,94,0.1)", title: "Converted 1,200 leads to qualified", time: "5 hours ago" },
{ icon: "📤", bg: "rgba(59,130,246,0.1)", title: "Exported 25,000 leads to CSV", time: "Yesterday" },
].map((act, i) => (
<div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--bg-hover)", borderRadius: 8 }}>
<div style={{ width: 32, height: 32, background: act.bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{act.icon}</div>
<div style={{ flex: 1 }}>
<div style={{ fontSize: 13, fontWeight: 600 }}>{act.title}</div>
<div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{act.time}</div>
</div>
</div>
))}
</div>
</div>
</div>
</div>
);
};
export default DashboardPage;
