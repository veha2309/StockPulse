# 🚀 StockPulse - Next-Gen Trading Terminal (Web)

StockPulse is a high-performance, glassmorphic trading dashboard designed for the E-Summit competition. It provides real-time market insights, advanced portfolio tracking, and a sophisticated options chain interface.

---

## ✨ Features

### 📊 Professional Dashboard
- **Glassmorphic UI**: Premium visual design with real-time blur and vibrant accents.
- **Dynamic P&L**: Real-time calculation of Profit and Loss across all equity and option holdings.
- **Wallet Integration**: Manage "E-Tokens" with instant trade settlements.

### 📈 Advanced Trading
- **Equity Holdings**: Buy and sell stocks with automated averaging and real-time pricing.
- **Options Chain**: Comprehensive PE/CE options list with Strike Price and Expiry filtering.
- **Automatic Targets**: Configure Stop Loss and Take Profit levels that persist across devices.

### 🛡️ Admin Control
- **Backend Sync**: Leverages Supabase Service Role for high-privilege operations (e.g., wallet management).
- **Audit Logs**: Full history of every trade made on the platform.

---

## 🛠️ Tech Stack
- **Framework**: [Next.js 14+](https://nextjs.org/)
- **Styling**: Tailwind CSS (Custom Glassmorphism)
- **Database/Auth**: [Supabase](https://supabase.com/)
- **Icons**: Lucide React

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- A Supabase account

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🏛️ Architecture
The application follows a modular structure focused on performance and real-time updates:
- `/app/api`: Serverless functions for high-privilege Supabase operations.
- `/components`: Reusable UI components (Dashboard, Portfolio, OptionsChain).
- `/lib`: Supabase clients and utility functions.
- `/schema.sql`: Database schema definition for rapid deployment.

---

> [!NOTE]
> This project was developed specifically for the **E-Summit** competition and is optimized for low-latency market simulations.

---
© 2026 StockPulse Team. All rights reserved.
