// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 9: Export to Excel
// ============================================================================

// Export Property View Data to Excel
function exportPropertyViewToExcel() {
    try {
        const property = propertyViewData.selectedProperty;
        if (!property) {
            showToast('Export Error', 'No property selected', '❌');
            return;
        }

        const reservations = propertyViewData.reservations;
        const activeRes = reservations.filter(r => r.status !== 'cancelled');

        // Calculate summary metrics
        const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const totalPaid = activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
        const totalPending = totalRevenue - totalPaid;
        const totalBookings = activeRes.length;
        const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        const occupancyRate = (totalNights / 365) * 100;
        const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
        const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

        // Prepare CSV content
        let csv = '';

        // Header
        csv += `Property Performance Report\n`;
        csv += `Property: ${property.name}\n`;
        csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
        csv += `\n`;

        // Summary Section
        csv += `SUMMARY METRICS\n`;
        csv += `Metric,Value\n`;
        csv += `Total Revenue,₹${totalRevenue.toLocaleString('en-IN')}\n`;
        csv += `Paid Amount,₹${totalPaid.toLocaleString('en-IN')}\n`;
        csv += `Pending Amount,₹${totalPending.toLocaleString('en-IN')}\n`;
        csv += `Total Bookings,${totalBookings}\n`;
        csv += `Total Nights,${totalNights}\n`;
        csv += `Occupancy Rate,${occupancyRate.toFixed(1)}%\n`;
        csv += `Average Daily Rate,₹${adr.toLocaleString('en-IN')}\n`;
        csv += `Collection Rate,${collectionRate.toFixed(1)}%\n`;
        csv += `\n\n`;

        // Reservations Section
        csv += `ALL RESERVATIONS\n`;
        csv += `Booking ID,Guest Name,Guest Email,Guest Phone,Check-In,Check-Out,Nights,Booking Type,Total Amount,Paid Amount,Pending Amount,Payment Status,Booking Status\n`;

        reservations.forEach(r => {
            const pending = (parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0);
            csv += `${r.booking_id || 'N/A'},`;
            csv += `"${r.guest_name || 'N/A'}",`;
            csv += `${r.guest_email || 'N/A'},`;
            csv += `${r.guest_phone || 'N/A'},`;
            csv += `${r.check_in || 'N/A'},`;
            csv += `${r.check_out || 'N/A'},`;
            csv += `${r.nights || 0},`;
            csv += `${BOOKING_TYPES[r.booking_type]?.label || r.booking_type || 'N/A'},`;
            csv += `₹${(parseFloat(r.total_amount) || 0).toLocaleString('en-IN')},`;
            csv += `₹${(parseFloat(r.paid_amount) || 0).toLocaleString('en-IN')},`;
            csv += `₹${pending.toLocaleString('en-IN')},`;
            csv += `${r.payment_status || 'N/A'},`;
            csv += `${r.status || 'N/A'}\n`;
        });

        csv += `\n\n`;

        // Booking Type Breakdown Section
        csv += `BOOKING TYPE BREAKDOWN\n`;
        csv += `Type,Bookings,% of Total,Total Revenue,% Revenue,Total Nights,Avg Nights,ADR\n`;

        const typeGroups = {};
        activeRes.forEach(r => {
            const type = r.booking_type || 'unknown';
            if (!typeGroups[type]) {
                typeGroups[type] = { bookings: [], totalRevenue: 0, totalNights: 0 };
            }
            typeGroups[type].bookings.push(r);
            typeGroups[type].totalRevenue += parseFloat(r.total_amount) || 0;
            typeGroups[type].totalNights += r.nights || 0;
        });

        Object.keys(typeGroups).forEach(type => {
            const group = typeGroups[type];
            const bookingPercent = (group.bookings.length / totalBookings) * 100;
            const revenuePercent = (group.totalRevenue / totalRevenue) * 100;
            const avgNights = group.bookings.length > 0 ? group.totalNights / group.bookings.length : 0;
            const typeAdr = group.totalNights > 0 ? group.totalRevenue / group.totalNights : 0;
            const typeInfo = BOOKING_TYPES[type] || { label: type };

            csv += `${typeInfo.label},`;
            csv += `${group.bookings.length},`;
            csv += `${bookingPercent.toFixed(1)}%,`;
            csv += `₹${group.totalRevenue.toLocaleString('en-IN')},`;
            csv += `${revenuePercent.toFixed(1)}%,`;
            csv += `${group.totalNights},`;
            csv += `${avgNights.toFixed(1)},`;
            csv += `₹${typeAdr.toLocaleString('en-IN')}\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fileName = `Property_Report_${property.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Export Successful', `Downloaded ${fileName}`, '📥');

    } catch (error) {
        console.error('Export error:', error);
        showToast('Export Error', 'Failed to export data', '❌');
    }
}

// Print Property View
function printPropertyView() {
    const property = propertyViewData.selectedProperty;
    if (!property) {
        showToast('Print Error', 'No property selected', '❌');
        return;
    }

    // Open print dialog
    window.print();
    showToast('Print', 'Opening print dialog...', '🖨️');
}
