import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

console.log("SERVER STARTING...");
dotenv.config();
console.log("DOTENV LOADED");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

console.log("Supabase URL present:", !!supabaseUrl);
console.log("Supabase Key present:", !!supabaseAnonKey);

let supabase: any;
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase client initialized successfully");
  } else {
    console.error("Supabase credentials missing - client not initialized");
  }
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      supabaseConfigured: !!supabase,
      env: process.env.NODE_ENV
    });
  });

  // API Routes
  app.get("/api/settings/:key", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', req.params.key)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return res.status(500).json({ error: error.message });
    }
    res.json({ value: data ? data.value : null });
  });

  app.post("/api/settings", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { key, value } = req.body;
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Inventory Routes
  app.get("/api/inventory", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }

    const formattedMonth = month.toString().padStart(2, '0');
    const firstDayOfMonth = `${year}-${formattedMonth}-01`;
    const lastDayOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    // Calculate carry-over (stock from all previous months)
    const { data: previousMovements, error: carryOverError } = await supabase
      .from('inventory')
      .select('type, units')
      .lt('date', firstDayOfMonth);

    if (carryOverError) return res.status(500).json({ error: carryOverError.message });

    const initialStock = (previousMovements || []).reduce((acc: number, m: any) => {
      return acc + (m.type === 'in' ? m.units : -m.units);
    }, 0);

    // Get current month movements
    const { data: movements, error: movementsError } = await supabase
      .from('inventory')
      .select('*')
      .gte('date', firstDayOfMonth)
      .lte('date', lastDayOfMonth)
      .order('date', { ascending: false });

    if (movementsError) return res.status(500).json({ error: movementsError.message });

    res.json({ initialStock, movements });
  });

  app.post("/api/inventory", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { type, subtype, units, description, invoice_number, date } = req.body;
    if (!type || !units || !description || !date) {
      return res.status(400).json({ error: "Required fields missing" });
    }
    
    const finalSubtype = type === 'out' ? subtype : null;
    
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ type, subtype: finalSubtype, units, description, invoice_number, date }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', req.params.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  });

  app.get("/api/transactions", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }
    
    const formattedMonth = month.toString().padStart(2, '0');
    const firstDayOfMonth = `${year}-${formattedMonth}-01`;
    const lastDayOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', firstDayOfMonth)
      .lte('date', lastDayOfMonth)
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/transactions", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { type, description, amount, date } = req.body;
    if (!type || !description || !amount || !date) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ type, description, amount, date }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', req.params.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.join(__dirname, "dist");
  const distExists = fs.existsSync(distPath);

  if (!isProd || !distExists) {
    console.log("Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
