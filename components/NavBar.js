import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Logo from "./Logo";
import { useAuth } from "./AuthProvider";

export default function NavBar() {
  const { user, signOut } = useAuth();

  return (
    <AppBar position="static" sx={{ mb: 4, bgcolor: '#111', boxShadow: '0 0 16px 2px #0f0, 0 0 8px 2px #ffa500', borderBottom: '3px solid #ffa500' }}>
      <Toolbar sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div" sx={{ ml: 2, color: '#fff', textShadow: '0 0 8px #0f0, 0 0 4px #ffa500' }}>
          Admin Portal
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {user && (
            <Button 
              onClick={signOut} 
              sx={{ bgcolor: 'orange', color: '#fff', mr: 2, boxShadow: '0 0 8px #ffa500', '&:hover': { bgcolor: '#ff9800', boxShadow: '0 0 16px #ffa500' } }}
            >
              Logout
            </Button>
          )}
          <Logo size={80} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}