import React from "react";
interface Props {
className: string;
}
const ValidatorPage: React.FC<Props> = ({ className }) => {
return (
<div className={className} id="validatorPage">
<div className="validator-grid">
<div className="validator-card">
<div className="validator-card-header">
<div className="validator-card-icon" style={{ background: "rgba(34,197,94,0.1)" }}>✅</div>
<div className="validator-card-title">Email Validator</div>
</div>
<div className="validator-card-desc">Verify email deliverability and check for bounce risks.</div>
<div className="validator-status ok"><span>✓</span> System Operational</div>
<button className="btn btn-primary validator-btn">Run Validation</button>
</div>
<div className="validator-card">
<div className="validator-card-header">
<div className="validator-card-icon" style={{ background: "rgba(59,130,246,0.1)" }}>🔗</div>
<div className="validator-card-title">Link Checker</div>
</div>
<div className="validator-card-desc">Validate website and LinkedIn URLs for all prospects.</div>
<div className="validator-status ok"><span>✓</span> System Operational</div>
<button className="btn btn-primary validator-btn">Run Check</button>
</div>
<div className="validator-card">
<div className="validator-card-header">
<div className="validator-card-icon" style={{ background: "rgba(245,158,11,0.1)" }}>📞</div>
<div className="validator-card-title">Phone Validator</div>
</div>
<div className="validator-card-desc">Verify phone number formats and country codes.</div>
<div className="validator-status warn"><span>⚠</span> 234 Records Need Attention</div>
<button className="btn btn-primary validator-btn">Run Validation</button>
</div>
<div className="validator-card">
<div className="validator-card-header">
<div className="validator-card-icon" style={{ background: "rgba(239,68,68,0.1)" }}>🗑</div>
<div className="validator-card-title">Duplicate Finder</div>
</div>
<div className="validator-card-desc">Scan and identify duplicate records in the database.</div>
<div className="validator-status error"><span>✕</span> 1,420 Duplicates Found</div>
<button className="btn btn-primary validator-btn">Scan Now</button>
</div>
</div>
</div>
);
};
export default ValidatorPage;
