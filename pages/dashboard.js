import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../components/AuthProvider";
import NavBar from "../components/NavBar";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import * as XLSX from "xlsx";
import { DataGrid } from '@mui/x-data-grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
// Import Firestore
import { getFirestore, collection, setDoc, doc, getDocs } from "firebase/firestore";
import { auth } from "../firebaseConFig";

const db = typeof window !== "undefined" ? getFirestore() : null; // Prevent SSR issues


export default function Dashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  // State for file upload
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef();

  // DataGrid state
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [filter, setFilter] = useState({ INSTALLED: '', DK: '', FZ: '' });
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('MAC ADDRESS');

  // Debug: log auth state after all hooks
  console.log("Dashboard rendered", { user, role, loading });

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) {
      router.replace("/");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    const fetchRows = async () => {
      setLoadingRows(true);
      const snapshot = await getDocs(collection(db, "records"));
      let data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setRows(data);
      setLoadingRows(false);
    };
    fetchRows();
  }, [user, role]);

  // Universal search: match any of the 3 fields
  const filteredRows = rows.filter(row => {
    if (!search) return true;
    const searchValue = search.toLowerCase();
    const mac = (row["MAC ADDRESS"] || "").toString().toLowerCase();
    const cable = (row["CABLE ID"] || "").toString().toLowerCase();
    const device = (row["DEVICE NAME / EXTENSION"] || "").toString().toLowerCase();
    return mac.includes(searchValue) || cable.includes(searchValue) || device.includes(searchValue);
  });

  // Handle cell edit
  const handleRowEdit = async (params) => {
    const { id, field, value } = params;
    const updatedRow = rows.find(r => r.id === id);
    if (!updatedRow) return;
    const newRow = { ...updatedRow, [field]: value };
    setRows(rows.map(r => r.id === id ? newRow : r));
    await setDoc(doc(collection(db, "records"), id), newRow);
  };


  // Handle .xlsx file upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      // Save each row as a document in Firestore (collection: 'records')
      // Delete all existing records first
      const snapshot = await getDocs(collection(db, "records"));
      const batchDelete = await import('firebase/firestore');
      // Delete all docs in parallel and wait for all to finish
      await Promise.all(snapshot.docs.map(docSnap => batchDelete.deleteDoc(doc(collection(db, "records"), docSnap.id))));
      // Now upload only one row per unique CABLE ID (last occurrence wins)
      const cableMap = new Map();
      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const id = row["CABLE ID"] && row["CABLE ID"].trim() !== "" ? row["CABLE ID"].trim() : crypto.randomUUID();
        cableMap.set(id, row); // last row for each CABLE ID will be kept
      }
      await Promise.all(Array.from(cableMap.entries()).map(([id, row]) => setDoc(doc(collection(db, "records"), id), row)));
      alert("Upload successful!");
      // Refetch rows to ensure UI is up to date
      if (user && role === "admin") {
        const newSnap = await getDocs(collection(db, "records"));
        let data = newSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setRows(data);
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // List your headers in the desired order
  const HEADERS = [
    "CABLE ID",
    "AREA",
    "DK",
    "FZ",
    "FRAME",
    "SIDE",
    "LOCATION",
    "SYSTEM",
    "INSTALLED",
    "DEVICE NAME / EXTENSION",
    "DEVICE TYPE (VENDOR)",
    "ANTENNA TYPE (VENDOR)",
    "DETAIL",
    "MAC ADDRESS",
    "USER",
    "REMARK GROUP",
    "REMARK DESCRIPTION",
    "AREA READY",
    "1st SEA TRIAL / GREEN ZONE",
    "FIELD NOTES"
  ];

  // Handle .xlsx download
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const snapshot = await getDocs(collection(db, "records"));
      let rows = snapshot.docs.map(doc => doc.data());

      // Ensure all rows have all headers, in the correct order
      rows = rows.map(row =>
        HEADERS.reduce((acc, key) => {
          acc[key] = row[key] !== undefined ? row[key] : "";
          return acc;
        }, {})
      );

      // Add headers as the first row (SheetJS will use this for column order)
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });

      // Set column order explicitly
      XLSX.utils.sheet_add_aoa(worksheet, [HEADERS], { origin: "A1" });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
      const wbout = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "records.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
    setDownloading(false);
  };


  return (
    <>
      {/* Sidebar */}
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#18191b' }}>
        <Box sx={{ width: 220, bgcolor: '#18191b', px: 2, py: 2, borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ width: '100%' }}>
            {/* Logo at top */}
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
              <img src="/logo.png" alt="Logo" style={{ width: 160, height: 'auto', marginBottom: 16 }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1, mb: 2 }}>Admin Portal</Typography>
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              variant="contained"
              sx={{ bgcolor: '#ff9800', color: '#18191b', fontWeight: 600, textTransform: 'none', mb: 2, width: '100%', boxShadow: 'none', '&:hover': { bgcolor: '#e67600' } }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload .xlsx"}
            </Button>
            <Button
              variant="contained"
              sx={{ bgcolor: '#43a047', color: '#fff', fontWeight: 600, textTransform: 'none', width: '100%', boxShadow: 'none', '&:hover': { bgcolor: '#388e3c' } }}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Downloading..." : "Download .xlsx"}
            </Button>
          </Box>

          {/* Logout at bottom */}
          <Button
            variant="contained"
            sx={{ bgcolor: '#ff9800', color: '#18191b', fontWeight: 600, textTransform: 'none', width: '100%', boxShadow: 'none', mb: 1, '&:hover': { bgcolor: '#e67600' } }}
            onClick={() => { auth.signOut(); router.replace('/'); }}
          >
            LOGOUT
          </Button>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 4, overflow: 'auto' }}>
          {/* Sticky header area */}
          <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: '#18191b', pb: 2 }}>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
              Admin Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <TextField
                variant="outlined"
                placeholder="Search by MAC, Cable ID, or Device Name/Extension"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ width: 260, bgcolor: '#232323', borderRadius: 1, input: { color: '#fff', fontSize: 15, p: 1 } }}
                InputProps={{ style: { color: '#fff', fontWeight: 400, borderRadius: 6 } }}
              />
              {/* INSTALLED Dropdown */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#ff9800' }}>INSTALLED</InputLabel>
                <Select
                  value={filter.INSTALLED}
                  label="INSTALLED"
                  onChange={e => setFilter(f => ({ ...f, INSTALLED: e.target.value }))}
                  sx={{ color: '#ff9800', borderColor: '#ff9800', bgcolor: '#232323',
                    '& .MuiSelect-icon': { color: '#43a047 !important' } }}
                  IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
                >
                  <MenuItem value="">All</MenuItem>
                  {[...new Set(rows.map(r => r["INSTALLED"]))].filter(Boolean).map(val => (
                    <MenuItem key={val} value={val}>{val}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* DK Dropdown */}
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel sx={{ color: '#ff9800' }}>DK</InputLabel>
                <Select
                  value={filter.DK}
                  label="DK"
                  onChange={e => setFilter(f => ({ ...f, DK: e.target.value }))}
                  sx={{ color: '#ff9800', borderColor: '#ff9800', bgcolor: '#232323',
                    '& .MuiSelect-icon': { color: '#43a047 !important' } }}
                  IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
                >
                  <MenuItem value="">All</MenuItem>
                  {[...new Set(rows.map(r => r["DK"]))].filter(Boolean).map(val => (
                    <MenuItem key={val} value={val}>{val}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* FZ Dropdown */}
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel sx={{ color: '#ff9800' }}>FZ</InputLabel>
                <Select
                  value={filter.FZ}
                  label="FZ"
                  onChange={e => setFilter(f => ({ ...f, FZ: e.target.value }))}
                  sx={{ color: '#ff9800', borderColor: '#ff9800', bgcolor: '#232323',
                    '& .MuiSelect-icon': { color: '#43a047 !important' } }}
                  IconComponent={props => <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
                >
                  <MenuItem value="">All</MenuItem>
                  {[...new Set(rows.map(r => r["FZ"]))].filter(Boolean).map(val => (
                    <MenuItem key={val} value={val}>{val}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* DataGrid Table Section */}
          <Box sx={{ flex: 1, width: '100%', overflowX: 'auto' }}>
            <DataGrid
              rows={filteredRows.filter(row =>
                (!filter.INSTALLED || row["INSTALLED"] === filter.INSTALLED) &&
                (!filter.DK || row["DK"] === filter.DK) &&
                (!filter.FZ || row["FZ"] === filter.FZ)
              )}
              columns={HEADERS.map(h => ({ field: h, headerName: h, minWidth: 120, flex: 1, editable: true, headerAlign: 'center', align: 'center', sortable: true }))}
              loading={loadingRows}
              onCellEditCommit={params => handleRowEdit(params)}
              disableRowSelectionOnClick
              sx={{
                color: '#fff',
                bgcolor: '#18191b',
                border: 'none',
                fontSize: 13,
                '& .MuiDataGrid-cell': { borderColor: '#232323', color: '#fff', bgcolor: '#18191b', py: 0.15, px: 1, fontSize: 13, minHeight: 24, maxHeight: 24 },
                '& .MuiDataGrid-columnHeaders': { bgcolor: '#232323', color: '#ff9800', fontWeight: 700, borderBottom: '2px solid #ff9800', fontSize: 14, minHeight: 32, maxHeight: 32, position: 'sticky', top: 0, zIndex: 12 },
                '& .MuiDataGrid-footerContainer': { bgcolor: '#232323', color: '#ff9800', borderTop: '2px solid #ff9800', minHeight: 30 },
                '& .MuiDataGrid-row': { minHeight: 24, maxHeight: 24, '&:hover': { bgcolor: '#222' } },
                '& .MuiDataGrid-virtualScroller': { bgcolor: '#18191b' },
                '& .MuiDataGrid-sortIcon': { color: '#43a047 !important' },
              }}
              pageSize={25}
              rowsPerPageOptions={[25, 50, 100]}
              autoHeight={false}
            />
          </Box>
        </Box>
      </Box>
    </>
  );
}