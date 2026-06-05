import React, { useState } from "react";

interface Props {
  onActivated: () => void;
}

const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formatKey = (input: string) => {
    const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join("-").substring(0, 19);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseKey(formatKey(e.target.value));
    setError(null);
  };

  const handleActivate = async () => {
    if (licenseKey.length < 4) {
      setError("Please enter a valid license key");
      return;
    }
    setLoading(true);
    setError(null);
    // Simulate activation (browser mode - any key works as demo)
    await new Promise(r => setTimeout(r, 1200));
    setSuccess(true);
    setTimeout(onActivated, 1200);
    setLoading(false);
  };

  return (
    <div className="activation-screen">
      <div className="activation-card">
        <div className="activation-logo">
          <span style={{ color: "#e63946", fontWeight: 800, fontSize: 24 }}>DZ</span>
        </div>
        <div className="activation-title">Activate Dimrz</div>
        <div className="activation-subtitle">Enter your license key to unlock 10M+ leads</div>
        {error && <div className="activation-error">{error}</div>}
        {success && <div className="activation-success">Activation successful! Opening...</div>}
        <input
          type="text"
          className="activation-input"
          value={licenseKey}
          onChange={handleChange}
          placeholder="DIMR-XXXX-XXXX-XXXX"
          maxLength={19}
          disabled={loading || success}
        />
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
          Format: DIMR-XXXX-XXXX-XXXX (from your purchase email)
        </p>
        <button
          className="activation-btn"
          onClick={handleActivate}
          disabled={loading || success || licenseKey.length < 4}
        >
          {loading ? "Activating..." : "Activate License"}
        </button>
        <div className="activation-footer">
          Don't have a license?{" "}
          <a href="https://dimrz.com/buy" target="_blank" rel="noopener noreferrer">Purchase here →</a>
        </div>
      </div>
    </div>
  );
};

export default ActivationScreen;
