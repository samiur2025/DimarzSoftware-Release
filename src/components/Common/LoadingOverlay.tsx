import React from "react";
interface Props {
active: boolean;
}
const LoadingOverlay: React.FC<Props> = ({ active }) => {
if (!active) return null;
return (
<div className="loading-overlay active" id="loadingOverlay">
<div className="spinner"></div>
<div className="loading-text">Processing...</div>
</div>
);
};
export default LoadingOverlay;
