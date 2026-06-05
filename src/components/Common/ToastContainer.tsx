import React from "react";
import type { Toast } from "../../App";
interface Props {
toasts: Toast[];
}
const ToastContainer: React.FC<Props> = ({ toasts }) => {
if (toasts.length === 0) return null;
return (
<div className="toast-container" id="toastContainer">
{toasts.map(toast => (
<div key={toast.id} className={`toast ${toast.type}`}>
<span style={{ fontSize: 16 }}>
{toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
</span>
<span className="toast-message">{toast.message}</span>
</div>
))}
</div>
);
};
export default ToastContainer;
