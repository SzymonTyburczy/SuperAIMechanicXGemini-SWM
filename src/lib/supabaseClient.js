import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tthxqibopxifyiofnuij.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0aHhxaWJvcHhpZnlpb2ZudWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODk1MjgsImV4cCI6MjA5MDI2NTUyOH0.x4ObwsWAE80w2w1B4LqdMdeUs2evcwwHI1g4FvZL3XU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)