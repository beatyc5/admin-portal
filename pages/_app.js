
import { AuthProvider } from "../components/AuthProvider";
import CssBaseline from "@mui/material/CssBaseline";
import Head from "next/head";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>Field Editor Admin Portal</title>
      </Head>
      <CssBaseline />
      <Component {...pageProps} />
    </AuthProvider>
  );
}