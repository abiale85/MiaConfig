## ✅ All Modal Issues Fixed

**This version fixes all 3 reported modal problems:**

### 🐛 Issues Resolved:
1. **Edit Modal** - Now appears in foreground (was opening in background)
2. **Collapse in Group By Override** - Toggle now works correctly (was using wrong CSS approach)
3. **Weekly View Popup** - Detail popup now appears when clicking bars

### 🔧 Root Cause & Fix:
- **Problem**: Modal-specific IDs (#dc-edit-modal, #dc-weekly-event-modal) were defined outside .mia-config-card scope, so they didn't inherit the .active display rule
- **Solution**: Added explicit CSS rules for all modal IDs:
  ```
  #dc-add-config-modal.active, #dc-edit-modal.active, #dc-weekly-event-modal.active {
      display: flex !important;
  }
  ```
- **JavaScript**: Complete multi-instance support using `cardElement._instance` instead of global variables
- **Collapse Fix**: dcToggleOverrideGroup now uses CSS classes instead of inline styles (like dcToggleConfigGroup)

### 🎯 Multi-Instance Support:
- **Before**: Used `window._miaConfigCardInstance` (breaks with multiple cards)
- **After**: Functions accept `cardElement` parameter and use `cardElement._instance`
- **Compatible**: Works with single or multiple MiaConfig cards on same page

### 🧪 How to test:
1. **Hard-reload** (Ctrl+F5)
2. **Edit button** → Modal should appear in foreground
3. **Collapse in group by override** → Should toggle open/close
4. **Weekly view bar click** → Detail popup should appear
5. **Multiple cards** → Each card works independently

### 📦 Versions:
- Integration: 2.1.0-beta.6
- Card: 2.1.0-beta.6

**All modals work correctly + full multi-instance support!** 🎉