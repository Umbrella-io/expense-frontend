# Expense Tracker Frontend

A modern Next.js 14 frontend application for tracking personal income and expenses. Built with TypeScript, TailwindCSS, and modern React patterns.

## Features

- 📊 **Dashboard**: Visual overview with pie charts showing expense and income breakdown by category
- 💰 **Transaction Management**: Add new income and expense transactions
- 🏷️ **Category Management**: Create and manage expense and income categories
- 📱 **Responsive Design**: Mobile-first design that works on all devices
- 🎨 **Modern UI**: Clean, minimal interface with smooth interactions
- 🏥 **Health Monitoring**: Real-time API health check with JSON response display

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd expense-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` and set your API URL:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

The application expects the following backend API endpoints:

- `GET /transactions` - Fetch all transactions
- `POST /transactions` - Create a new transaction
- `GET /transactions/aggregate` - Get aggregated transaction data for charts
- `GET /categories` - Fetch all categories
- `POST /categories` - Create a new category
- `GET /health` - Health check endpoint for monitoring API status

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx          # Dashboard (/)
│   ├── add/page.tsx      # Add Transaction (/add)
│   ├── categories/page.tsx # Categories (/categories)
│   ├── health/page.tsx   # Health Check (/health)
│   └── layout.tsx        # Root layout with navigation
├── components/            # Reusable components
│   ├── Navigation.tsx    # Main navigation
│   ├── LoadingSpinner.tsx # Loading indicator
│   └── Health.tsx        # Health check component
└── lib/                  # Utility functions
    ├── api.ts            # API wrapper functions
    └── types.ts          # TypeScript type definitions
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set the `NEXT_PUBLIC_API_URL` environment variable in Vercel
4. Deploy!

### Other Platforms

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `https://my-backend.onrender.com/api` |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
