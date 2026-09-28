import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastViewport } from "./components/ui";
import { Landing } from "./pages/Landing";
import { CreateVault } from "./pages/CreateVault";
import { Dashboard } from "./pages/Dashboard";
import { Explore } from "./pages/Explore";
import { VaultDetail } from "./pages/VaultDetail";
import { Claim } from "./pages/Claim";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateVault />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/vault/:owner" element={<VaultDetail />} />
          <Route path="/claim" element={<Claim />} />
          <Route path="/claim/:owner" element={<Claim />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <ToastViewport />
    </>
  );
}
