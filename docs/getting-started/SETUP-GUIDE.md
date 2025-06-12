# 🚀 DHCP Fix - Quick Start Guide

## ✅ Build Fixed Successfully!

The TypeScript build errors have been fixed. Now you need to configure your OPNsense connection.

## 📋 Setup Steps

### 1. Create your .env file
```bash
# Copy the example file
cp .env.example .env

# Or on Windows
copy .env.example .env
```

### 2. Edit .env with your OPNsense details
Add your actual OPNsense credentials:
```env
OPNSENSE_HOST=https://192.168.1.1    # Your OPNsense IP/hostname
OPNSENSE_API_KEY=your-api-key-here   # From System > Access > Users
OPNSENSE_API_SECRET=your-secret-here  # API secret key
OPNSENSE_VERIFY_SSL=false            # Set to true if using valid SSL
```

### 3. Run the setup and test script
```bash
# Windows
setup-and-test.bat

# Mac/Linux
npm run build && node test-dhcp-fix.js
```

## 🔍 What Was Fixed

1. **Build Error**: Removed invalid `lease.hostname` reference in `getMacManufacturer()` method
2. **Module System**: Updated test scripts to use ES modules instead of CommonJS
3. **Error Handling**: Added better null checks and response normalization

## 🛠️ Troubleshooting

If DHCP still doesn't work after setup:

1. **Run the comprehensive debug**:
   ```bash
   node debug-dhcp-comprehensive.js
   ```
   This will test all possible API endpoints and show which one returns data.

2. **Check your API user permissions** in OPNsense:
   - Go to System → Access → Users
   - Edit your API user
   - Ensure it has permissions for DHCP/Services

3. **Verify DHCP service is running**:
   - Check in OPNsense: Services → DHCPv4

4. **Try alternative endpoints** if the default doesn't work:
   - The debug script will show you which endpoints are available
   - Update `src/api/client.ts` if needed

## 📝 Files Created/Updated

- ✅ Fixed `src/resources/services/dhcp/leases.ts` - No more build errors
- ✅ Updated test scripts for ES modules
- ✅ Created `setup-and-test.bat` for easy setup
- ✅ Comprehensive debug tools ready to use

## 🎯 Next Steps

1. Create your `.env` file with OPNsense credentials
2. Run `setup-and-test.bat` (Windows) or build & test manually
3. Restart Claude Desktop
4. Try DHCP commands like "list all DHCP leases"

Happy networking! 🌐
