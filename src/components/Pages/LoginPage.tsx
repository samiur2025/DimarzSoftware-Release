import React, { useState } from "react";

interface Props {
  onLogin: () => void;
}

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    
    // In a real secure app, we'd hash the input password.
    // Here we'll do a simple localstorage check since it's just a local app lock.
    const storedHash = localStorage.getItem("dimrz_app_lock_password");
    
    // Simple hashing simulation for local comparison
    const hashString = async (str: string) => {
      if (crypto && crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        return btoa(str).split("").reverse().join("");
      }
    };

    const inputHash = await hashString(password);

    if (inputHash === storedHash) {
      setError(null);
      onLogin();
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="activation-screen">
      <div className="activation-card animation-fade-in" style={{ padding: "40px 30px" }}>
        <div className="activation-logo">
          <span style={{ color: "#e63946", fontWeight: 800, fontSize: 24 }}>DZ</span>
        </div>
        <div className="activation-title">Welcome Back</div>
        <div className="activation-subtitle">Enter your password to unlock the dashboard.</div>
        
        {error && <div className="activation-error" style={{ marginBottom: "16px" }}>{error}</div>}
        
        <form onSubmit={handleLogin}>
          <input
            type="password"
            className="activation-input"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Enter password..."
            style={{ marginBottom: "24px" }}
            autoFocus
          />
          <button type="submit" className="activation-btn">
            Unlock App
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
