import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
    },
  },
});

export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  isPaused?: boolean;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(supabaseUrl, {
      signal: controller.signal,
      method: 'HEAD',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 503) {
        return {
          connected: false,
          error: 'Supabase project appears to be paused or unavailable',
          isPaused: true,
        };
      }
      return {
        connected: false,
        error: `Server returned status ${response.status}`,
      };
    }

    return { connected: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          connected: false,
          error: 'Connection timeout - server not responding',
        };
      }
      if (error.message.includes('Failed to fetch')) {
        return {
          connected: false,
          error: 'Network error - cannot reach Supabase server',
          isPaused: true,
        };
      }
      return {
        connected: false,
        error: error.message,
      };
    }
    return {
      connected: false,
      error: 'Unknown connection error',
    };
  }
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'doctor';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: 'admin' | 'doctor';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: 'admin' | 'doctor';
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          name: string;
          phone: string;
          gender: string;
          dob: string | null;
          age: number | null;
          address: string;
          created_at: string;
          updated_at: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          name: string;
          type: 'medicine' | 'lab_consumable';
          unit: string;
          qty_on_hand: number;
          reorder_level: number;
          cost_price: number;
          sell_price: number;
          created_at: string;
          updated_at: string;
        };
      };
      tests: {
        Row: {
          id: string;
          name: string;
          price: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
      };
      test_consumptions: {
        Row: {
          id: string;
          test_id: string;
          item_id: string;
          qty_used: number;
          created_at: string;
        };
      };
      visits: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          notes: string;
          diagnosis: string;
          subtotal: number;
          total: number;
          paid: number;
          balance: number;
          payment_status: 'paid' | 'unpaid' | 'partial';
          created_at: string;
          updated_at: string;
        };
      };
      visit_tests: {
        Row: {
          id: string;
          visit_id: string;
          test_id: string;
          price: number;
          qty: number;
          result_text: string;
          created_at: string;
        };
      };
      visit_medicines: {
        Row: {
          id: string;
          visit_id: string;
          item_id: string;
          price: number;
          qty: number;
          instructions: string;
          created_at: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          item_id: string;
          movement_type: 'IN' | 'OUT' | 'ADJUST';
          qty: number;
          reason: string;
          reference_type: string;
          reference_id: string | null;
          performed_by: string;
          created_at: string;
        };
      };
      facility_settings: {
        Row: {
          id: string;
          name: string;
          address: string;
          phone: string;
          footer_note: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
