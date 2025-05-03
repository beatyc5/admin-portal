import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/router";
import { useAuth } from "../components/AuthProvider";
import { auth } from "../firebaseConfig";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import NavBar from "../components/NavBar";

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!loading && user && role === "admin") {
    router.replace("/dashboard");
    return null;
  }
  if (!loading && user && role === "field_team") {
    router.replace("/field-team");
    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid credentials");
    }
  };

  return (
    <>
      {/* SVG geometric/circuit background */}
      <Box minHeight="100vh" sx={{ bgcolor: '#141516', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
          <rect x="5%" y="10%" width="40" height="40" rx="8" fill="none" stroke="#ffa500" strokeWidth="2" filter="url(#glow1)" />
          <rect x="90%" y="10%" width="40" height="40" rx="8" fill="none" stroke="#0f0" strokeWidth="2" filter="url(#glow2)" />
          <rect x="5%" y="80%" width="40" height="40" rx="8" fill="none" stroke="#0f0" strokeWidth="2" filter="url(#glow2)" />
          <rect x="90%" y="80%" width="40" height="40" rx="8" fill="none" stroke="#ffa500" strokeWidth="2" filter="url(#glow1)" />
          <defs>
            <filter id="glow1" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
        <Box
          sx={{
            p: 6,
            borderRadius: 4,
            bgcolor: '#18191b',
            boxShadow: '0 0 32px 8px #0f0, 0 0 16px 8px #ffa500',
            border: '2px solid #ffa500',
            minWidth: 360,
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo at top of card */}
          <img src="/logo.png" alt="Logo" width={120} height={52} style={{ marginBottom: 24, marginTop: -12 }} />
          <Typography variant="h5" mb={2} sx={{ color: '#fff', textShadow: '0 0 8px #0f0, 0 0 4px #ffa500' }}>
            Welcome Back
          </Typography>
          <form onSubmit={handleLogin} style={{ width: "100%" }}>
            <TextField
              label="Email Address"
              variant="filled"
              fullWidth
              margin="normal"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
              InputProps={{
                style: { color: '#fff', background: '#222', borderRadius: 6, border: '1px solid #ffa500' }
              }}
              InputLabelProps={{ style: { color: '#ffa500' } }}
            />
            <TextField
              label="Password"
              type="password"
              variant="filled"
              fullWidth
              margin="normal"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              InputProps={{
                style: { color: '#fff', background: '#222', borderRadius: 6, border: '1px solid #0f0' }
              }}
              InputLabelProps={{ style: { color: '#0f0' } }}
            />
            {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
            <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, bgcolor: '#ffa500', color: '#111', fontWeight: 'bold', boxShadow: '0 0 8px #ffa500', '&:hover': { bgcolor: '#ff9800', boxShadow: '0 0 16px #ffa500' } }}>
              Login
            </Button>
          </form>
        </Box>
      </Box>
    </>
  );
}