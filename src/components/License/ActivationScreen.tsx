import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  onActivated: () => void;
}

const ActivationScreen: React.FC<Props> = ({ onActivated }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    
    try {
      await invoke("activate_license", { licenseKey: licenseKey });
      setStep(3); // Move to welcome screen
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Failed to activate license.");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      <div className={`step-dot ${step >= 1 ? "active" : ""}`}></div>
      <div className={`step-line ${step >= 2 ? "active" : ""}`}></div>
      <div className={`step-dot ${step >= 2 ? "active" : ""}`}></div>
      <div className={`step-line ${step >= 3 ? "active" : ""}`}></div>
      <div className={`step-dot ${step >= 3 ? "active" : ""}`}></div>
    </div>
  );

  return (
    <div className="activation-screen">
      <div className="activation-card">
        <div className="activation-logo">
          <span style={{ color: "#e63946", fontWeight: 800, fontSize: 24 }}>DZ</span>
        </div>
        
        {renderStepIndicator()}

        {step === 1 && (
          <div className="setup-step animation-fade-in">
            <div className="activation-title">End User License Agreement</div>
            <div className="activation-subtitle">Please read and accept the terms to continue</div>
            
            <div className="terms-box">
              <h3>1. Acceptance of Terms</h3>
              <p>By installing and using Dimrz Leads Software ("Software"), you agree to be bound by these terms.</p>
              <h3>2. License Grant</h3>
              <p>You are granted a non-exclusive, non-transferable license to use the Software on the activated device.</p>
              <h3>3. Restrictions</h3>
              <p>You may not reverse engineer, decompile, or disassemble the Software. You may not distribute or share your license key.</p>
              <h3>4. Data Privacy</h3>
              <p>Your hardware ID is collected solely for licensing verification purposes. No personal lead data is transmitted.</p>
              <br />
              <p><i>[Replace this placeholder text with your actual EULA]</i></p>
            </div>

            <label className="terms-checkbox-container">
              <input 
                type="checkbox" 
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>I have read and agree to the Terms and Conditions</span>
            </label>

            <button
              className="activation-btn"
              onClick={() => setStep(2)}
              disabled={!agreedToTerms}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step animation-fade-in">
            <div className="activation-title">Activate Dimrz</div>
            <div className="activation-subtitle">Enter your license key to unlock 10M+ leads</div>
            
            {error && <div className="activation-error">{error}</div>}
            
            <input
              type="text"
              className="activation-input"
              value={licenseKey}
              onChange={handleChange}
              placeholder="DIMR-XXXX-XXXX-XXXX"
              maxLength={19}
              disabled={loading}
              style={{ marginTop: 20 }}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              Format: DIMR-XXXX-XXXX-XXXX (from your purchase email)
            </p>
            
            <button
              className="activation-btn"
              onClick={handleActivate}
              disabled={loading || licenseKey.length < 4}
              style={{ marginTop: 24 }}
            >
              {loading ? "Activating..." : "Activate License"}
            </button>
            
            <div className="activation-footer">
              Don't have a license?{" "}
              <a href="https://dimrz.com/buy" target="_blank" rel="noopener noreferrer">Purchase here →</a>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="setup-step animation-fade-in">
            <div className="activation-title">Welcome to Dimrz!</div>
            <div className="activation-subtitle">Your software is fully activated and ready.</div>
            
            <div className="tips-list">
              <div className="tip-item">
                <div className="tip-icon">🔎</div>
                <div className="tip-text">
                  <strong>Powerful Filtering</strong>
                  <p>Use the left sidebar to drill down into millions of records instantly.</p>
                </div>
              </div>
              <div className="tip-item">
                <div className="tip-icon">📥</div>
                <div className="tip-text">
                  <strong>CSV Exporting</strong>
                  <p>Select the leads you want and export them securely for your campaigns.</p>
                </div>
              </div>
              <div className="tip-item">
                <div className="tip-icon">⚙️</div>
                <div className="tip-text">
                  <strong>Local Storage</strong>
                  <p>Your data is processed locally, ensuring maximum speed and security.</p>
                </div>
              </div>
            </div>

            <button
              className="activation-btn"
              onClick={onActivated}
              style={{ marginTop: 30 }}
            >
              Finish & Launch Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivationScreen;
