/**
 * ResIQ Type Definitions
 * Core TypeScript interfaces for the application
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface Reservation {
  id?: number
  booking_id: string
  property_id: string
  property_name: string
  check_in: string
  check_out: string
  nights: number
  guest_name: string
  guest_email: string
  guest_phone: string
  number_of_guests: number
  total_amount: number
  paid_amount?: number
  balance_amount?: number
  booking_type: BookingType
  booking_source: string
  status: ReservationStatus
  notes?: string
  ota_booking_id?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  user_id?: string
}

export interface Payment {
  id?: string
  booking_id: string
  property_name: string
  guest_name: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  notes?: string
  created_at?: string
  updated_at?: string
  created_by?: string
  user_id?: string
}

export interface Property {
  id?: string
  name: string
  location?: string
  property_type?: string
  capacity?: number
  base_price?: number
  status?: PropertyStatus
  airbnb_ical_url?: string
  booking_ical_url?: string
  last_sync?: string
  sync_status?: SyncStatus
  created_at?: string
  updated_at?: string
  user_id?: string
}

export interface Guest {
  id?: string
  name: string
  email: string
  phone: string
  id_proof_type?: string
  id_proof_number?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  total_bookings?: number
  total_revenue?: number
  first_booking_date?: string
  last_booking_date?: string
  created_at?: string
  updated_at?: string
}

export interface GuestDocument {
  id?: string
  guest_email: string
  guest_name: string
  guest_phone?: string
  booking_id: string
  property_name: string
  document_type: DocumentType
  document_url: string
  status: DocumentStatus
  verified_by?: string
  verified_at?: string
  rejection_reason?: string
  created_at?: string
  updated_at?: string
}

export interface TeamMember {
  id?: string
  email: string
  full_name?: string
  role: UserRole
  avatar_url?: string
  created_at?: string
  last_sign_in?: string
}

export interface Communication {
  id?: string
  booking_id: string
  guest_phone: string
  message_type: string
  message_content: string
  sent_at: string
  sent_by: string
  user_id?: string
}

export interface PushSubscription {
  id?: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  device_type?: string
  browser?: string
  created_at?: string
  updated_at?: string
}

// ============================================================================
// Enums & Constants
// ============================================================================

export type BookingType =
  | 'STAYCATION'
  | 'WEDDING'
  | 'BIRTHDAY'
  | 'CORPORATE_EVENT'
  | 'CORPORATE_STAY'
  | 'SHOOT'

export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'PENDING'

export type PaymentMethod =
  | 'UPI'
  | 'Cash'
  | 'Bank Transfer'
  | 'Card'
  | 'Cheque'
  | 'OTA'

export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'

export type SyncStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'NEVER_SYNCED'

export type DocumentType =
  | 'ID_PROOF'
  | 'ADDRESS_PROOF'
  | 'PHOTO'
  | 'OTHER'

export type DocumentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'

export type UserRole =
  | 'admin'
  | 'manager'
  | 'staff'
  | 'owner'

// ============================================================================
// UI State Types
// ============================================================================

export interface AppState {
  currentView: string
  isSidebarCollapsed: boolean
  isOnline: boolean
  syncInProgress: boolean
  currentUser: TeamMember | null
  selectedPropertyId?: string
  selectedDateRange?: DateRange
}

export interface DateRange {
  startDate: string
  endDate: string
}

export interface FilterOptions {
  propertyId?: string
  status?: ReservationStatus
  bookingType?: BookingType
  dateRange?: DateRange
  searchQuery?: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SupabaseResponse<T> {
  data: T[] | null
  error: SupabaseError | null
  count?: number
}

export interface SupabaseError {
  message: string
  code?: string
  details?: string
  hint?: string
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface DashboardMetrics {
  totalRevenue: number
  totalBookings: number
  averageBookingValue: number
  occupancyRate: number
  pendingPayments: number
  upcomingCheckIns: number
}

export interface PropertyPerformance {
  property_id: string
  property_name: string
  total_bookings: number
  total_revenue: number
  total_nights: number
  occupancy_rate: number
  average_booking_value: number
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string
  borderWidth?: number
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ToastOptions {
  title: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

export interface ModalOptions {
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

// ============================================================================
// Global Window Extensions
// ============================================================================

declare global {
  interface Window {
    supabase: any
    createClient: any
    // State
    state: AppState
    allReservations: Reservation[]
    allPayments: Payment[]
    selectedReservations: Set<string>
    currentUser: TeamMember | null
    currentWhatsAppBooking: Reservation | null
    // Functions (legacy global exports)
    formatCurrency: (amount: number) => string
    formatDate: (date: string) => string
    showToast: (title: string, message: string, type?: string) => void
    showLoading: (message?: string) => void
    hideLoading: () => void
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    loadReservations: () => Promise<void>
    loadPayments: () => Promise<void>
    // ... other global functions
  }
}

export {}
