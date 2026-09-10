import { Route, BrowserRouter, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Marketplaces } from "./pages/Marketplaces";
import { ProductDetail } from "./pages/ProductDetail";
import { Products } from "./pages/Products";
import { Settings } from "./pages/Settings";
import { Sourcing } from "./pages/Sourcing";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="marketplaces" element={<Marketplaces />} />
          <Route path="sourcing" element={<Sourcing />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
