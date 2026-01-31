// src/constants/clinic-settings.ts

export const CLINIC_SETTINGS = {
    // 法人・院の構成設定
    is_multi_clinic: true, 
    tracking_mode: 'monthly', // 'daily' | 'monthly'
    
    // 管理画面で表示するモジュールの制御
    active_admin_modules: ['upload', 'goals', 'edit', 'mapping'],
  
    // ダッシュボードのレイアウト構成
    kpi_layout: [
      { 
        category: 'profit', 
        label: '収益性',
        items: [
          { id: 'revenue', label: '売上', unit: '円' },
          { id: 'unit_price', label: 'レセプト平均単価', unit: '円' },
          { id: 'patients', label: '来院患者数', unit: '名' },
          { id: 'new_patients', label: '新規患者数', unit: '名' },
        ]
      },
      { 
        category: 'booking', 
        label: '予約精度',
        items: [
          { id: 'cancel_rate', label: 'キャンセル率', unit: '%' },
          { id: 'today_cancel_rate', label: '当日キャンセル率', unit: '%' },
          { id: 'reserve_rate', label: '予約取得率', unit: '%' },
        ]
      }
    ]
  };