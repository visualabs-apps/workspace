# Target Dashboard Implementation

## Overview
Implementasi Target Dashboard di v-box untuk menampilkan data KPI dan target dari EOS Dashboard (http://localhost:2026/eos-dashboard).

## Struktur Implementasi

### 1. Target Store (`src/lib/stores/targets.svelte.js`)
Store untuk state management data target dengan fitur:
- Load targets dari API `/scorecard-data/dashboard`
- Pagination (50 items per page)
- Filter: customerId, subscriptionId, category, assignedTo, threshold
- Load more functionality

### 2. Target Window (`src/components/windows/TargetWindow.svelte`)
Window component untuk menampilkan target dashboard dengan fitur:
- Draggable window menggunakan BaseWindow
- Display target cards dengan informasi:
  - Title & category
  - Customer & subscription info
  - Actual vs Target values
  - Threshold status (Green/Yellow/Red)
  - Trend indicator (Up/Down/Stable)
  - Period info (year/month/week)
  - PIC/Assignee info
- Filter panel (Category & Threshold)
- Refresh button
- Load more pagination
- Empty & loading states

### 3. Integration
- Button di TopToolbar menu (Settings dropdown)
- Export di `src/components/index.js`
- Export store di `src/lib/stores/index.js`

## Data Flow

```
Backend API (/api/scorecard-data/dashboard)
    ↓
Target Store (targets.svelte.js)
    ↓
Target Window (TargetWindow.svelte)
    ↓
User Interface
```

## API Endpoint
- **Endpoint**: `/api/scorecard-data/dashboard`
- **Method**: GET
- **Query Params**:
  - page: number (default: 1)
  - limit: number (default: 50)
  - customerId: number (optional)
  - subscriptionId: number (optional)
  - category: number (optional) - 0: Goal/Target, 1: Indikator, 2: Aktifitas
  - assignedTo: number (optional)
  - threshold: number (optional) - 0: Green, 1: Yellow, 2: Red
  - sortBy: string (default: 'createdAt')
  - sortOrder: 'asc' | 'desc' (default: 'desc')

## Database Schema Reference

### scorecards table
- targetValue: Target KPI value
- targetType: 0=minimum (higher better), 1=maximum (lower better)
- category: 0=Goal/Target, 1=Indikator, 2=Aktifitas
- greenThreshold, yellowThreshold: Performance thresholds

### scorecardData table
- actualValue: Actual KPI value
- targetValue: Target for specific period
- threshold: 0=Green, 1=Yellow, 2=Red (auto-calculated)
- trend: 0=default, 1=down, 2=stable, 3=up (auto-calculated)
- status: 1=current period, 0=past

## Usage

1. Klik icon Settings (gear) di TopToolbar
2. Pilih "Target Dashboard" dari menu
3. Window Target akan terbuka
4. Gunakan filter untuk menyaring data
5. Klik "Load More" untuk pagination
6. Klik "Refresh" untuk reload data

## Features

- ✅ Display target cards dengan informasi lengkap
- ✅ Filter by category (Goal/Target, Indikator, Aktifitas)
- ✅ Filter by threshold status (Green, Yellow, Red)
- ✅ Pagination dengan load more
- ✅ Refresh data
- ✅ Draggable window
- ✅ Empty & loading states
- ✅ Responsive layout

## Future Enhancements

- [ ] Search functionality
- [ ] Sort options
- [ ] Export to CSV
- [ ] Chart visualization
- [ ] Detail view per target
- [ ] Edit target values
- [ ] Filter by customer/subscription
- [ ] Filter by assignee
- [ ] Date range filter
