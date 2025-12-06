// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 4: Payment Breakdown
// ============================================================================

// Render Payment Collection Breakdown
function renderPaymentBreakdown(reservations, payments) {
    const container = document.getElementById('propertyPaymentBreakdown');

    // Filter active reservations
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    if (activeRes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No payment data available
            </div>
        `;
        return;
    }

    // Calculate totals
    const totalAmount = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const paidAmount = activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    // Calculate percentages
    const paidPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    const pendingPercent = totalAmount > 0 ? (pendingAmount / totalAmount) * 100 : 0;

    // Group by payment status
    const paymentStatusGroups = {
        paid: activeRes.filter(r => r.payment_status === 'paid'),
        partial: activeRes.filter(r => r.payment_status === 'partial'),
        pending: activeRes.filter(r => r.payment_status === 'pending'),
        unpaid: activeRes.filter(r => r.payment_status === 'unpaid')
    };

    // Calculate amounts for each status
    const statusBreakdown = {
        paid: {
            count: paymentStatusGroups.paid.length,
            amount: paymentStatusGroups.paid.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        partial: {
            count: paymentStatusGroups.partial.length,
            amount: paymentStatusGroups.partial.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        pending: {
            count: paymentStatusGroups.pending.length,
            amount: paymentStatusGroups.pending.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        unpaid: {
            count: paymentStatusGroups.unpaid.length,
            amount: paymentStatusGroups.unpaid.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        }
    };

    // Render breakdown
    container.innerHTML = `
        <!-- Overall Collection Summary -->
        <div style="background: var(--card-bg); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Overall Collection</h4>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: var(--text-secondary);">Total Amount:</span>
                <strong style="color: var(--text-primary);">${formatCurrency(totalAmount)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: var(--text-secondary);">Paid Amount:</span>
                <strong style="color: var(--success);">${formatCurrency(paidAmount)} (${paidPercent.toFixed(1)}%)</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <span style="color: var(--text-secondary);">Pending Amount:</span>
                <strong style="color: var(--danger);">${formatCurrency(pendingAmount)} (${pendingPercent.toFixed(1)}%)</strong>
            </div>

            <!-- Visual Progress Bar -->
            <div style="width: 100%; height: 30px; background: var(--bg-secondary); border-radius: 8px; overflow: hidden; display: flex;">
                <div style="width: ${paidPercent}%; background: var(--success); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                    ${paidPercent > 10 ? `${paidPercent.toFixed(0)}%` : ''}
                </div>
                <div style="width: ${pendingPercent}%; background: var(--danger); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                    ${pendingPercent > 10 ? `${pendingPercent.toFixed(0)}%` : ''}
                </div>
            </div>
        </div>

        <!-- Payment Status Breakdown -->
        <div style="background: var(--card-bg); border-radius: 8px; padding: 20px;">
            <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Payment Status Breakdown</h4>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Bookings</th>
                        <th>Total Amount</th>
                        <th>% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="badge" style="background: var(--success);">Paid</span></td>
                        <td>${statusBreakdown.paid.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.paid.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.paid.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--warning);">Partial</span></td>
                        <td>${statusBreakdown.partial.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.partial.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.partial.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--warning);">Pending</span></td>
                        <td>${statusBreakdown.pending.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.pending.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.pending.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--danger);">Unpaid</span></td>
                        <td>${statusBreakdown.unpaid.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.unpaid.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.unpaid.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}
