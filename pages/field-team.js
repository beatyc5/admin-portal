import { useEffect, useRef, useState } from "react";
import localforage from "localforage";
import { useAuth } from "../components/AuthProvider";
import { useRouter } from "next/router";
import { getFirestore, collection, setDoc, doc, getDocs } from "firebase/firestore";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { DataGrid } from "@mui/x-data-grid";
import useMediaQuery from '@mui/material/useMediaQuery';

const db = typeof window !== "undefined" ? getFirestore() : null;

const HEADERS = [
  "CABLE ID","AREA","DK","FZ","FRAME","SIDE","LOCATION","SYSTEM","INSTALLED","DEVICE NAME / EXTENSION","DEVICE TYPE (VENDOR)","ANTENNA TYPE (VENDOR)","DETAIL","MAC ADDRESS","USER","REMARK GROUP","REMARK DESCRIPTION","AREA READY","1st SEA TRIAL / GREEN ZONE","FIELD NOTES"
];

const REMARK_GROUPS = [
  "CABLE_REMARK_DATA",
  "AREA_READINESS",
  "BRACKET_BOX_REMARK",
  "DEVICE_REMARK",
  "TROUBLESHOOT"
];

const REMARK_OPTIONS = {
  "CABLE_REMARK_DATA": [
    "BAD CABLE TERMINATION","BROKEN CABLE","CABLE DAMAGED","CABLE ID DUPLICATED","CABLE IN WRONG SWITCH","CABLE IN WRONG PLACE","CABLE IS BEING USED FOR ANOTHER SYSTEM","CABLE IS CUT","CABLE NEEDS EXTENSION","CABLE NOT TERMINATED","CABLE SOCKET IN WRONG PLACE","CABLE SOCKET NOT INSTALLED PROPERLY","CABLE TOO LONG","CABLE TOO SHORT","CABLE/SOCKET NOT LABELED","DELAYED CABLE","MISMATCH PORT","MISSING CABLE IN THE FIELD","MISSING CABLE IN THE RDP","MISSING FACE PLATE FOR CABLE SOCKET","MISSING LABEL ON CABLE","MISSING SOCKET FOR CABLE","MISSING SURFACE BOX FOR CABLE","WRONG LABEL ON CABLE"
  ],
  "AREA_READINESS": [
    "ANTENNA INSTALLED IN WRONG PLACE","CABINET HAVE DAMAGE","DATA SOCKET BROKEN","DEAD LOCK","HOLE IN WRONG PLACE","HOLE NOT CENTERED","MISSING ANTENNA","MISSING CEILING","MISSING GROMMET","MISSING HOLE IN THE FURNITURE","MISSING PENETRATION","NEEDS CARPENTER","NEEDS HATCH","NEEDS HOLE","NEEDS INFORMATION FROM ROYAL","NEEDS INFORMATION FROM VENDOR","NEEDS INFORMATION FROM YARD","NEEDS KEY (METAL)","NEEDS KEY (PLASTIC)","NEEDS LIFT MACHINE","NEEDS MOUNTING HOLE","NEEDS PAINTING","NEEDS SCAFFOLD","NO ACCESS AREA BLOCKED","NO SPACE TO INSTALL THE DEVICE","NOT READY","OCCUPIED","STORAGE","WRONG HOLE"
  ],
  "BRACKET_BOX_REMARK": [
    "BOLT THREAD IS WRONG","BOX IS IN THE WRONG DIRECTION","BRACKET IN WRONG POSITION","INSTALLED IN THE WRONG PLACE","MISSING ANTENNA SUPPORT","MISSING BOX","MISSING BOX SUPPORT","MISSING BRACKET","MISSING HOLE TO SCREW","MOUNTING PLATE WRONG DIRECTION","NO SPACE TO INSTALL","WRONG BOX","WRONG BRACKET"
  ],
  "DEVICE_REMARK": [
    "BAD DEVICE","BAD SWITCH PORT","BROKEN DEVICE","DEVICE JACK DAMAGED","DEVICE REMOVED","MISSING A DEVICE PIECE","NO PORT AVAILABLE IN THE SWITCH","NO POWER TO SWITCH","RDP NOT PATCHED","SWITCH NO UPLINK","SWITCH NOT PROGRAMMED","THE SWITCH WAS REMOVED","WRONG ANTENNA TYPE INSTALLED"
  ],
  "TROUBLESHOOT": [
    "NETWORK TEAM","VLAN IS WRONG","WGC"
  ]
};

const INSTALLED_OPTIONS = ["Yes", "No"];

export default function FieldTeamEditor() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [pendingEdits, setPendingEdits] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Persisted filter/search state
  const [filterModel, setFilterModel] = useState({ items: [] });
  const [searchCableId, setSearchCableId] = useState("");
  const [searchMac, setSearchMac] = useState("");
  const [searchDevice, setSearchDevice] = useState("");
  // filter, editingRowId, editingRow declared here only. Do not redeclare elsewhere.
  const [filter, setFilter] = useState({ DK: '', FZ: '', INSTALLED: '' });
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRow, setEditingRow] = useState({});

  // Restore filter/search state from localforage on mount
  useEffect(() => {
    localforage.getItem('fieldTeamFilterModel').then(model => {
      setFilterModel(model || { items: [] });
    });
    localforage.getItem('fieldTeamSearchCableId').then(saved => {
      if (saved) setSearchCableId(saved);
    });
    localforage.getItem('fieldTeamSearchMac').then(saved => {
      if (saved) setSearchMac(saved);
    });
    localforage.getItem('fieldTeamSearchDevice').then(saved => {
      if (saved) setSearchDevice(saved);
    });
  }, []);

  // Listen for online/offline events and show offline banner
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      FieldTeamEditor.syncEdits();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // On mount, try to sync pending edits if online
  useEffect(() => {
    const trySync = async () => {
      const edits = await localforage.getItem('pendingEdits');
      if (navigator.onLine && edits && edits.length > 0) {
        await FieldTeamEditor.syncEdits();
      }
    };
    trySync();
  }, []);

  // Network status
  useEffect(() => {
    const updateStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // Load pending edits from localforage (reload on network status change)
  useEffect(() => {
    localforage.getItem('pendingEdits').then(edits => {
      console.log('[localforage] loaded pendingEdits:', edits);
      setPendingEdits(edits || []);
    });
  }, [isOffline]);

  // Load/cached rows from Firestore or localforage
  useEffect(() => {
    // Allow cached data to load even if not authenticated
    if (!isOffline) {
      if (!user) return; // Only fetch from Firestore if authenticated
      FieldTeamEditor.fetchRows().then(data => {
        console.log('[Firestore FETCH]', data); // LOG FETCH
        setRows(data);
        if (data && data.length > 0) {
          localforage.setItem('fieldRows', data).then(() => {
            console.log('[localforage] wrote fieldRows:', data);
            // Confirm we do NOT touch pendingEdits here
            localforage.getItem('pendingEdits').then(edits => {
              console.log('[after Firestore fetch, pendingEdits still]:', edits);
              // Explicitly reload pendingEdits to avoid race conditions
              setPendingEdits(edits || []);
            });
          });
        }
      });
    } else {
      // Always try to load cached data when offline
      localforage.getItem('fieldRows').then(data => {
        if (data && data.length > 0) {
          console.log('[localforage] loaded fieldRows:', data);
          setRows(data);
        }
      });
    }
  }, [user, isOffline]);

  // Enforce login
  // Only allow users with role 'field_team' or 'admin'
  useEffect(() => {
    if (!loading && !navigator.onLine) return; // Don't redirect if offline
    if (!loading && (!user || (role !== "field_team" && role !== "admin"))) {
      router.replace("/");
    }
  }, [user, role, loading, router]);

  // Fetch rows from Firestore
  FieldTeamEditor.fetchRows = async () => {
    const snapshot = await getDocs(collection(db, "records"));
    let data = snapshot.docs.map(docSnap => {
      // Ensure all HEADERS are present
      const row = { id: docSnap.id, ...docSnap.data() };
      return HEADERS.reduce((acc, key) => {
        acc[key] = row[key] !== undefined ? row[key] : '';
        return acc;
      }, { id: row.id });
    });
    console.log('[Firestore FETCH RESULT]', data);
    return data;
  };

  // Filtering and search
  const getInstalledString = v => {
    if (typeof v === 'string') {
      if (v.trim().toLowerCase() === 'yes') return 'Yes';
      if (v.trim().toLowerCase() === 'no') return 'No';
    }
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    return '';
  };
  const filteredRows = rows.filter(row => {
    if (filter.DK && row.DK !== filter.DK) return false;
    if (filter.FZ && row.FZ !== filter.FZ) return false;
    if (filter.INSTALLED) {
      if (getInstalledString(row.INSTALLED) !== filter.INSTALLED) return false;
    }
    if (searchCableId && !(row['CABLE ID'] || '').toString().toLowerCase().includes(searchCableId.toLowerCase())) return false;
    if (searchMac && !(row['MAC ADDRESS'] || '').toString().toLowerCase().includes(searchMac.toLowerCase())) return false;
    if (searchDevice && !(row['DEVICE NAME / EXTENSION'] || '').toString().toLowerCase().includes(searchDevice.toLowerCase())) return false;
    return true;
  });

  // Handle cell edit (with offline support)
  FieldTeamEditor.handleEdit = async (id, field, value) => {
    console.log('[handleEdit] called with:', { id, field, value, online: navigator.onLine });

    // Update state and cache
    const prevRows = [...rows];
    const newRows = prevRows.map(row => row.id === id ? { ...row, [field]: value } : row);
    setRows(newRows);
    localforage.setItem('fieldRows', newRows);

    if (navigator.onLine) {
      try {
        await setDoc(doc(collection(db, "records"), id), { [field]: value }, { merge: true });
        console.log('[Firestore WRITE SUCCESS]', id, { [field]: value });
      } catch (err) {
        console.error('[Firestore WRITE ERROR]', id, err);
      }
    } else {
      // Offline: queue edit, update cache, etc.
      const edit = { id, field, value };
      const existingEdits = (await localforage.getItem('pendingEdits')) || [];
      const newEdits = [...existingEdits, edit];
      setPendingEdits(newEdits);
      await localforage.setItem('pendingEdits', newEdits);
      console.log('[localforage] wrote pendingEdits:', newEdits);
    }
  };

  // Sync local edits when online
  FieldTeamEditor.syncEdits = async () => {
    if (!navigator.onLine || syncing || pendingEdits.length === 0) return;
    setSyncing(true);
    for (const edit of pendingEdits) {
      await setDoc(doc(collection(db, "records"), edit.id), { [edit.field]: edit.value }, { merge: true });
    }
    setPendingEdits([]);
    await localforage.setItem('pendingEdits', []);
    console.log('[localforage] cleared pendingEdits after sync');
    setSyncing(false);
    // Optionally, refresh data from Firestore
    FieldTeamEditor.fetchRows().then(data => {
      setRows(data);
      localforage.setItem('fieldRows', data);
    });
  };


  // Sync local edits when online
  FieldTeamEditor.syncEdits = async () => {
    if (!navigator.onLine || syncing || pendingEdits.length === 0) return;
    setSyncing(true);
    for (const edit of pendingEdits) {
      await setDoc(doc(collection(db, "records"), edit.id), { [edit.field]: edit.value }, { merge: true });
    }
    setPendingEdits([]);
    await localforage.setItem('pendingEdits', []);
    setSyncing(false);
    // Optionally, refresh data from Firestore
    FieldTeamEditor.fetchRows().then(data => {
      setRows(data);
      localforage.setItem('fieldRows', data);
    });
  };

  // DataGrid columns
  const isMobile = useMediaQuery('(max-width:900px)');

  const columns = HEADERS.map(header => {
    // Hide columns on mobile
    const mobileHidden = ["AREA", "DK", "FZ", "FRAME", "SIDE", "LOCATION", "SYSTEM"].includes(header) && isMobile;
    // Remark Group dropdown
    if (header === "REMARK GROUP") {
      return {
        field: "REMARK GROUP",
        headerName: "REMARK GROUP",
        minWidth: 180,
        flex: 1,
        editable: true,
        type: "singleSelect",
        valueOptions: REMARK_GROUPS,
        hide: mobileHidden,
      };
    }
    // Remark Description dependent dropdown
    if (header === "REMARK DESCRIPTION") {
      return {
        field: "REMARK DESCRIPTION",
        headerName: "REMARK DESCRIPTION",
        minWidth: 220,
        flex: 1,
        editable: true,
        type: "singleSelect",
        valueOptions: params => {
          const group = params.row["REMARK GROUP"];
          const options = REMARK_OPTIONS[group] || [];
          // If value is missing or not in options, default to empty string
          if (!options.includes(params.row["REMARK DESCRIPTION"])) {
            params.row["REMARK DESCRIPTION"] = '';
          }
          return options;
        },
        hide: mobileHidden,
      };
    }
    // Editable fields
    if (header === "MAC ADDRESS" || header === "FIELD NOTES" || header === "REMARK GROUP") {
      return {
        field: header,
        headerName: header,
        minWidth: 180,
        flex: 1,
        editable: true,
        hide: mobileHidden,
      };
    }
    // Default
    return {
      field: header,
      headerName: header,
      minWidth: 180,
      flex: 1,
      editable: false,
      hide: mobileHidden,
    };
  });

  return (
    <Box sx={{ bgcolor: '#18191b', minHeight: '100vh', p: 0 }}>
    {/* Logo and sync badge */}
    <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
      <img src="/logo.png" alt="Logo" style={{ width: 100, height: 'auto', marginRight: 12 }} />
      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mr: 2 }}>Field Team Editor</Typography>
    </Box>
    {/* Filters and search */}
    <Box sx={{
      display: 'flex',
      gap: 2,
      alignItems: { xs: 'stretch', md: 'center' },
      flexDirection: { xs: 'column', md: 'row' },
      p: 2,
      flexWrap: 'wrap',
      bgcolor: '#232323',
      borderBottom: '2px solid #ff9800',
      position: 'sticky',
      top: 0,
      zIndex: 20
    }}>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel sx={{ color: '#ff9800' }}>DK</InputLabel>
        <Select
          value={filter.DK}
          label="DK"
          onChange={e => setFilter(f => ({ ...f, DK: e.target.value }))}
          sx={{ color: '#ff9800', bgcolor: '#232323', '& .MuiSelect-icon': { color: '#43a047 !important' } }}
          IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
        >
          <MenuItem value="">All</MenuItem>
          {[...new Set(rows.map(r => r["DK"]))].filter(Boolean).map(val => (
            <MenuItem key={val} value={val}>{val}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel sx={{ color: '#ff9800' }}>FZ</InputLabel>
        <Select
          value={filter.FZ}
          label="FZ"
          onChange={e => setFilter(f => ({ ...f, FZ: e.target.value }))}
          sx={{ color: '#ff9800', bgcolor: '#232323', '& .MuiSelect-icon': { color: '#43a047 !important' } }}
          IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
        >
          <MenuItem value="">All</MenuItem>
          {[...new Set(rows.map(r => r["FZ"]))].filter(Boolean).map(val => (
            <MenuItem key={val} value={val}>{val}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel sx={{ color: '#ff9800' }}>INSTALLED</InputLabel>
        <Select
          value={filter.INSTALLED}
          label="INSTALLED"
          onChange={e => setFilter(f => ({ ...f, INSTALLED: e.target.value }))}
          sx={{ color: '#ff9800', bgcolor: '#232323', '& .MuiSelect-icon': { color: '#43a047 !important' } }}
          IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
        >
          <MenuItem value="">All</MenuItem>
          {INSTALLED_OPTIONS.map(val => (
            <MenuItem key={val} value={val}>{val}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="CABLE ID"
        variant="outlined"
        value={searchCableId}
        onChange={e => setSearchCableId(e.target.value)}
        sx={{ minWidth: 180, bgcolor: '#232323', input: { color: '#fff' }, label: { color: '#ff9800' } }}
      />
      <TextField
        size="small"
        label="MAC ADDRESS"
        variant="outlined"
        value={searchMac}
        onChange={e => setSearchMac(e.target.value)}
        sx={{ minWidth: 180, bgcolor: '#232323', input: { color: '#fff' }, label: { color: '#ff9800' } }}
      />
      <TextField
        size="small"
        label="DEVICE NAME / EXTENSION"
        variant="outlined"
        value={searchDevice}
        onChange={e => setSearchDevice(e.target.value)}
        sx={{ minWidth: 220, bgcolor: '#232323', input: { color: '#fff' }, label: { color: '#ff9800' } }}
      />
    </Box>
    {/* DataGrid */}
    {isOffline && (
      <Box sx={{ bgcolor: '#d84315', color: '#fff', p: 1, mb: 1, borderRadius: 1, textAlign: 'center' }}>
        You are offline. Changes will be saved locally and synced when connection is restored.
      </Box>
    )}
    <Box sx={{
      width: '100%',
      minWidth: 0,
      minHeight: 400,
      maxHeight: '70vh',
      bgcolor: '#18191b',
      p: 2,
      overflow: 'auto',
      display: 'block'
    }}>
      <DataGrid
        rows={filteredRows}
        columns={columns}
        filterModel={filterModel}
        onFilterModelChange={model => {
          setFilterModel(model);
          localforage.setItem('fieldTeamFilterModel', model);
        }}
        processRowUpdate={async (newRow, oldRow) => {
          const changedField = Object.keys(newRow).find(
            key => newRow[key] !== oldRow[key]
          );
          console.log('processRowUpdate', { newRow, oldRow, changedField });
          if (changedField) {
            await FieldTeamEditor.handleEdit(newRow.id, changedField, newRow[changedField]);
          }
          return newRow;
        }}
        experimentalFeatures={{ newEditingApi: true }}
        sx={{
          height: '60vh',
          minWidth: '1200px',
          bgcolor: '#18191b',
          color: '#fff',
          borderColor: '#ffa500',
          '& .MuiDataGrid-cell': { color: '#fff', borderColor: '#222' },
          '& .MuiDataGrid-columnHeaders': { color: '#ffa500', backgroundColor: '#232323', fontWeight: 700, borderColor: '#ffa500' },
          '& .MuiDataGrid-row': { backgroundColor: '#18191b' },
          '& .MuiDataGrid-footerContainer': { color: '#fff', backgroundColor: '#232323', borderTop: '1px solid #ffa500' },
          '& .MuiInputBase-input': { color: '#fff', backgroundColor: '#232323' },
          '& .MuiSelect-select': { color: '#fff', backgroundColor: '#232323' },
          '& .MuiSvgIcon-root': { color: '#ffa500' },
          '& .MuiDataGrid-columnSeparator': { color: '#ffa500' },
        }}
      />
      {filteredRows.length === 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography sx={{ color: '#ffa500', fontWeight: 'bold' }}>
            No data found. Check your filters or try syncing.
          </Typography>
        </Box>
      )}
    </Box>
  </Box>
  );
}
