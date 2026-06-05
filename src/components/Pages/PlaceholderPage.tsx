import React from "react";
interface Props {
id: string;
className: string;
icon: string;
title: string;
subtitle: string;
}
const PlaceholderPage: React.FC<Props> = ({ id, className, icon, title, subtitle }) => {
return (
<div className={className} id={id}>
<div className="empty-state">
<div className="empty-state-icon">{icon}</div>
<div className="empty-state-title">{title}</div>
<div style={{ fontSize: 13 }}>{subtitle}</div>
</div>
</div>
);
};
export default PlaceholderPage;
