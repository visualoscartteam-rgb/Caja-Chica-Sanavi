import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://mhaelfinvkgqnndecvnj.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYWVsZmludmtncW5uZGVjdm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzA3MjIsImV4cCI6MjA4NzAwNjcyMn0.xjVSD-UyrBH--P5E8rRpI4UjEOWRlmmLGs4nDLGIMOA";

console.log("Initializing Supabase with URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", supabase: !!supabase });
  });

  app.get("/api/transactions", async (req, res) => {
    console.log("Handling /api/transactions");
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: "Month and year required" });
    
    const formattedMonth = month.toString().padStart(2, '0');
    const firstDay = `${year}-${formattedMonth}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/inventory", async (req, res) => {
    console.log("Handling /api/inventory");
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: "Month and year required" });

    const formattedMonth = month.toString().padStart(2, '0');
    const firstDay = `${year}-${formattedMonth}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data: prev, error: e1 } = await supabase.from('inventory').select('type, units').lt('date', firstDay);
    if (e1) return res.status(500).json({ error: e1.message });

    const initialStock = (prev || []).reduce((acc: number, m: any) => acc + (m.type === 'in' ? m.units : -m.units), 0);

    const { data: movements, error: e2 } = await supabase
      .from('inventory')
      .select('*')
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: false });

    if (e2) return res.status(500).json({ error: e2.message });
    res.json({ initialStock, movements });
  });

  app.post("/api/transactions", async (req, res) => {
    const { type, description, amount, date } = req.body;
    const { data, error } = await supabase.from('transactions').insert([{ type, description, amount, date }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/inventory", async (req, res) => {
    const { type, subtype, units, description, invoice_number, date } = req.body;
    const { data, error } = await supabase.from('inventory').insert([{ type, subtype: type === 'out' ? subtype : null, units, description, invoice_number, date }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    const { error } = await supabase.from('transactions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    const { error } = await supabase.from('inventory').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  });

  app.get("/api/settings/:key", async (req, res) => {
    const { data, error } = await supabase.from('settings').select('value').eq('key', req.params.key).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ value: data ? data.value : null });
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    const { error } = await supabase.from('settings').upsert({ key, value });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Vite middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
