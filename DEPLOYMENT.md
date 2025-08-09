# Deployment Guide

## Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: Expense Tracker Frontend"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect it's a Next.js project

3. **Set Environment Variables**
   - In your Vercel project settings, add:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
   ```

4. **Deploy**
   - Vercel will automatically build and deploy your app
   - Each push to main will trigger a new deployment

## Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_API_URL=https://your-backend-api.com/api
```

**Important**: Replace `https://your-backend-api.com/api` with your actual backend API URL.

## Build Commands

- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Start Production**: `npm start`

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check that your backend API is accessible
- Verify all dependencies are installed

### Runtime Errors
- Check browser console for API errors
- Verify the `NEXT_PUBLIC_API_URL` is correct
- Ensure your backend is running and accessible

## Custom Domain (Optional)

1. In Vercel, go to your project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow the DNS configuration instructions 