/**
 * Invoicing Module - GST Compliant Invoice Generation
 * Handles invoice creation, PDF generation, and GST calculations
 */

import { supabase } from './config.js'
import { showToast, showLoading, hideLoading } from './ui.js'
import { getCurrentUser } from './auth.js'

// Company details (from env or config)
const COMPANY_DETAILS = {
    name: 'Hostsphere India Private Limited',
    tradeName: 'Hostizzy',
    address: 'Your Business Address',
    city: 'City, State - PIN',
    gstin: 'YOUR_GSTIN_NUMBER',
    pan: 'YOUR_PAN_NUMBER',
    email: 'admin@hostizzy.com',
    phone: '+91 XXXXXXXXXX',
    website: 'www.hostizzy.com'
}

// ============================================
// INVOICE GENERATION
// ============================================

export async function generateInvoice(booking_id) {
    try {
        showLoading('Generating Invoice...')

        // Get booking details
        const { data: booking, error: bookingError } = await supabase
            .from('reservations')
            .select('*')
            .eq('booking_id', booking_id)
            .single()

        if (bookingError) throw bookingError

        // Get payments for this booking
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('booking_id', booking_id)
            .order('payment_date', { ascending: true })

        if (paymentsError) throw paymentsError

        // Calculate invoice data
        const invoiceData = calculateInvoiceData(booking, payments)

        // Save invoice to database
        const invoice = await saveInvoice(invoiceData)

        // Generate PDF
        await generateInvoicePDF(invoice, booking, payments)

        hideLoading()
        showToast('Success', 'Invoice generated successfully', '✅')

        return invoice

    } catch (error) {
        console.error('Invoice generation error:', error)
        hideLoading()
        showToast('Error', 'Failed to generate invoice: ' + error.message, '❌')
        throw error
    }
}

// ============================================
// CALCULATE INVOICE DATA
// ============================================

function calculateInvoiceData(booking, payments) {
    const subtotal = parseFloat(booking.total_amount) || 0
    const gstRate = 18 // 18% GST for hospitality services

    // Calculate GST breakdown
    const cgst = (subtotal * (gstRate / 2)) / 100
    const sgst = (subtotal * (gstRate / 2)) / 100
    const totalGST = cgst + sgst
    const grandTotal = subtotal + totalGST

    // Calculate payments
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const balance = grandTotal - totalPaid

    return {
        booking_id: booking.booking_id,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email || '',
        guest_phone: booking.guest_phone || '',
        guest_address: booking.guest_address || '',
        property_name: booking.property_name || 'Property',
        check_in: booking.check_in,
        check_out: booking.check_out,
        nights: calculateNights(booking.check_in, booking.check_out),
        subtotal: subtotal,
        cgst_rate: gstRate / 2,
        cgst_amount: cgst,
        sgst_rate: gstRate / 2,
        sgst_amount: sgst,
        total_gst: totalGST,
        grand_total: grandTotal,
        total_paid: totalPaid,
        balance_due: balance,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: booking.check_in
    }
}

function calculateNights(checkIn, checkOut) {
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diff = Math.abs(end - start)
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ============================================
// SAVE INVOICE TO DATABASE
// ============================================

async function saveInvoice(invoiceData) {
    try {
        // Generate invoice number (format: INV-YYYY-XXXX)
        const invoiceNumber = await generateInvoiceNumber()

        const invoice = {
            invoice_number: invoiceNumber,
            booking_id: invoiceData.booking_id,
            guest_name: invoiceData.guest_name,
            invoice_date: invoiceData.invoice_date,
            due_date: invoiceData.due_date,
            subtotal: invoiceData.subtotal,
            cgst_amount: invoiceData.cgst_amount,
            sgst_amount: invoiceData.sgst_amount,
            total_gst: invoiceData.total_gst,
            grand_total: invoiceData.grand_total,
            status: invoiceData.balance_due <= 0 ? 'paid' : 'pending',
            created_by: (getCurrentUser())?.email || 'system'
        }

        const { data, error } = await supabase
            .from('invoices')
            .insert([invoice])
            .select()
            .single()

        if (error) throw error

        return { ...data, ...invoiceData }

    } catch (error) {
        console.error('Save invoice error:', error)
        throw error
    }
}

async function generateInvoiceNumber() {
    const year = new Date().getFullYear()

    // Get count of invoices this year
    const { count, error } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`)
        .lt('created_at', `${year + 1}-01-01`)

    if (error) {
        console.error('Error getting invoice count:', error)
        // Fallback to random number
        return `INV-${year}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    }

    const nextNumber = (count || 0) + 1
    return `INV-${year}-${nextNumber.toString().padStart(4, '0')}`
}

// ============================================
// GENERATE PDF INVOICE
// ============================================

async function generateInvoicePDF(invoice, booking, payments) {
    try {
        // Load jsPDF library if not already loaded
        if (typeof window.jspdf === 'undefined') {
            await loadJsPDF()
        }

        const { jsPDF } = window.jspdf
        const doc = new jsPDF()

        // Page setup
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const margin = 20

        // Colors (Ocean Breeze theme)
        const primaryColor = [14, 165, 233] // #0ea5e9
        const textColor = [15, 23, 42] // #0f172a
        const lightGray = [241, 245, 249] // #f1f5f9

        let yPos = margin

        // ===== HEADER =====
        doc.setFillColor(...primaryColor)
        doc.rect(0, 0, pageWidth, 40, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(24)
        doc.setFont(undefined, 'bold')
        doc.text(COMPANY_DETAILS.tradeName, margin, 20)

        doc.setFontSize(10)
        doc.setFont(undefined, 'normal')
        doc.text('TAX INVOICE', pageWidth - margin, 20, { align: 'right' })
        doc.text(invoice.invoice_number, pageWidth - margin, 27, { align: 'right' })

        yPos = 50

        // ===== COMPANY DETAILS =====
        doc.setTextColor(...textColor)
        doc.setFontSize(10)
        doc.setFont(undefined, 'bold')
        doc.text('From:', margin, yPos)

        doc.setFont(undefined, 'normal')
        doc.setFontSize(9)
        doc.text(COMPANY_DETAILS.name, margin, yPos + 6)
        doc.text(COMPANY_DETAILS.address, margin, yPos + 11)
        doc.text(COMPANY_DETAILS.city, margin, yPos + 16)
        doc.text(`GSTIN: ${COMPANY_DETAILS.gstin}`, margin, yPos + 21)
        doc.text(`Email: ${COMPANY_DETAILS.email}`, margin, yPos + 26)

        // ===== CUSTOMER DETAILS =====
        doc.setFont(undefined, 'bold')
        doc.setFontSize(10)
        doc.text('Bill To:', pageWidth / 2 + 10, yPos)

        doc.setFont(undefined, 'normal')
        doc.setFontSize(9)
        doc.text(invoice.guest_name, pageWidth / 2 + 10, yPos + 6)
        if (invoice.guest_email) doc.text(invoice.guest_email, pageWidth / 2 + 10, yPos + 11)
        if (invoice.guest_phone) doc.text(invoice.guest_phone, pageWidth / 2 + 10, yPos + 16)
        if (invoice.guest_address) doc.text(invoice.guest_address, pageWidth / 2 + 10, yPos + 21)

        yPos += 40

        // ===== INVOICE DETAILS =====
        doc.setFillColor(...lightGray)
        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')

        doc.setFont(undefined, 'bold')
        doc.setFontSize(9)
        doc.text('Invoice Date:', margin + 5, yPos + 5)
        doc.text('Due Date:', pageWidth / 2 + 10, yPos + 5)

        doc.setFont(undefined, 'normal')
        doc.text(formatDate(invoice.invoice_date), margin + 35, yPos + 5)
        doc.text(formatDate(invoice.due_date), pageWidth / 2 + 35, yPos + 5)

        yPos += 15

        // ===== LINE ITEMS TABLE =====
        doc.setFontSize(10)
        doc.setFont(undefined, 'bold')

        // Table headers
        doc.setFillColor(...primaryColor)
        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')

        doc.setTextColor(255, 255, 255)
        doc.text('Description', margin + 5, yPos + 5)
        doc.text('Amount', pageWidth - margin - 5, yPos + 5, { align: 'right' })

        yPos += 10

        // Items
        doc.setTextColor(...textColor)
        doc.setFont(undefined, 'normal')
        doc.setFontSize(9)

        const description = `${invoice.property_name} - Stay (${formatDate(booking.check_in)} to ${formatDate(booking.check_out)})`
        const nights = invoice.nights

        doc.text(description, margin + 5, yPos + 5)
        doc.text(`${nights} ${nights === 1 ? 'night' : 'nights'}`, margin + 5, yPos + 10)
        doc.text(`₹${invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos + 5, { align: 'right' })

        yPos += 20

        // Subtotal line
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 8

        // ===== TOTALS SECTION =====
        const totalsX = pageWidth - margin - 60

        // Subtotal
        doc.text('Subtotal:', totalsX, yPos)
        doc.text(`₹${invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos, { align: 'right' })
        yPos += 6

        // CGST
        doc.text(`CGST (${invoice.cgst_rate}%):`, totalsX, yPos)
        doc.text(`₹${invoice.cgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos, { align: 'right' })
        yPos += 6

        // SGST
        doc.text(`SGST (${invoice.sgst_rate}%):`, totalsX, yPos)
        doc.text(`₹${invoice.sgst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos, { align: 'right' })
        yPos += 8

        // Grand Total
        doc.setFont(undefined, 'bold')
        doc.setFontSize(11)
        doc.setFillColor(...lightGray)
        doc.rect(totalsX - 5, yPos - 4, pageWidth - totalsX - margin + 10, 10, 'F')

        doc.text('Grand Total:', totalsX, yPos + 3)
        doc.text(`₹${invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 5, yPos + 3, { align: 'right' })

        yPos += 15

        // ===== PAYMENT DETAILS =====
        if (payments && payments.length > 0) {
            doc.setFontSize(10)
            doc.setFont(undefined, 'bold')
            doc.text('Payment History:', margin, yPos)
            yPos += 7

            doc.setFontSize(9)
            doc.setFont(undefined, 'normal')

            payments.forEach((payment, index) => {
                doc.text(
                    `${formatDate(payment.payment_date)} - ${payment.payment_method} - ₹${parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    margin + 5,
                    yPos
                )
                yPos += 5
            })

            yPos += 5

            // Balance Due
            doc.setFont(undefined, 'bold')
            doc.setFontSize(10)
            const balanceText = invoice.balance_due <= 0 ? 'PAID IN FULL' : `Balance Due: ₹${invoice.balance_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            const balanceColor = invoice.balance_due <= 0 ? [16, 185, 129] : [239, 68, 68]
            doc.setTextColor(...balanceColor)
            doc.text(balanceText, margin, yPos)
            doc.setTextColor(...textColor)
        }

        // ===== FOOTER =====
        doc.setFontSize(8)
        doc.setFont(undefined, 'italic')
        doc.setTextColor(100, 100, 100)
        doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' })
        doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, pageHeight - 15, { align: 'center' })

        // Save PDF
        const fileName = `Invoice_${invoice.invoice_number}_${invoice.guest_name.replace(/\s+/g, '_')}.pdf`
        doc.save(fileName)

        return fileName

    } catch (error) {
        console.error('PDF generation error:', error)
        throw error
    }
}

// Load jsPDF library dynamically
function loadJsPDF() {
    return new Promise((resolve, reject) => {
        if (typeof window.jspdf !== 'undefined') {
            resolve()
            return
        }

        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load jsPDF'))
        document.head.appendChild(script)
    })
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

// ============================================
// INVOICE MANAGEMENT
// ============================================

export async function listInvoices(filters = {}) {
    try {
        let query = supabase
            .from('invoices')
            .select('*')
            .order('invoice_date', { ascending: false })

        if (filters.booking_id) {
            query = query.eq('booking_id', filters.booking_id)
        }

        if (filters.status) {
            query = query.eq('status', filters.status)
        }

        if (filters.from_date) {
            query = query.gte('invoice_date', filters.from_date)
        }

        if (filters.to_date) {
            query = query.lte('invoice_date', filters.to_date)
        }

        const { data, error } = await query

        if (error) throw error

        return data

    } catch (error) {
        console.error('List invoices error:', error)
        throw error
    }
}

export async function getInvoice(invoice_id) {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoice_id)
            .single()

        if (error) throw error

        return data

    } catch (error) {
        console.error('Get invoice error:', error)
        throw error
    }
}

export async function deleteInvoice(invoice_id) {
    try {
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', invoice_id)

        if (error) throw error

        showToast('Success', 'Invoice deleted', '✅')

    } catch (error) {
        console.error('Delete invoice error:', error)
        showToast('Error', 'Failed to delete invoice', '❌')
        throw error
    }
}

// ============================================
// LOAD INVOICES VIEW
// ============================================

export async function loadInvoices() {
    try {
        showLoading('Loading invoices...')

        const invoices = await listInvoices()

        // Render invoices table
        renderInvoicesTable(invoices)

        hideLoading()

    } catch (error) {
        console.error('Load invoices error:', error)
        hideLoading()
        showToast('Error', 'Failed to load invoices', '❌')
    }
}

function renderInvoicesTable(invoices) {
    const tableBody = document.getElementById('invoicesTableBody')
    if (!tableBody) {
        console.warn('Invoices table body not found')
        return
    }

    if (!invoices || invoices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Invoices Yet</div>
                    <div style="font-size: 14px;">Generate invoices from the Payments view</div>
                </td>
            </tr>
        `
        return
    }

    tableBody.innerHTML = invoices.map(invoice => {
        const statusColors = {
            pending: 'var(--warning)',
            paid: 'var(--success)',
            overdue: 'var(--danger)',
            cancelled: 'var(--text-tertiary)'
        }

        const statusColor = statusColors[invoice.status] || 'var(--text-secondary)'

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${invoice.invoice_number}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${formatDate(invoice.invoice_date)}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${invoice.guest_name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${invoice.booking_id || '-'}</div>
                </td>
                <td style="text-align: right; font-weight: 600;">
                    ₹${invoice.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                        ${invoice.status}
                    </span>
                </td>
                <td style="text-align: center; font-size: 13px; color: var(--text-secondary);">
                    ${formatDate(invoice.due_date)}
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-secondary" onclick="window.downloadInvoice('${invoice.id}')" title="Download PDF">
                        📥
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.viewInvoice('${invoice.id}')" title="View Details">
                        👁️
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.deleteInvoice('${invoice.id}').then(() => window.loadInvoices())" title="Delete">
                        🗑️
                    </button>
                </td>
            </tr>
        `
    }).join('')
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.generateInvoice = generateInvoice
    window.listInvoices = listInvoices
    window.getInvoice = getInvoice
    window.deleteInvoice = deleteInvoice
    window.loadInvoices = loadInvoices
}

export { COMPANY_DETAILS }
