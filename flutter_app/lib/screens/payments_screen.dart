import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/payment.dart';
import '../providers/payments_provider.dart';
import '../providers/reservations_provider.dart';
import '../widgets/shimmer_card.dart';

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final payments = ref.watch(paymentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payments',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
      ),
      body: payments.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(
              8, (_) => const Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: ShimmerCard(height: 72),
              )),
        ),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.payments_outlined,
                      size: 48,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurfaceVariant
                          .withOpacity(0.3)),
                  const SizedBox(height: 12),
                  const Text('No payments recorded yet'),
                ],
              ),
            );
          }

          // Group by month
          final grouped = <String, List<Payment>>{};
          for (final p in list) {
            final key = p.paymentDate.length >= 7
                ? p.paymentDate.substring(0, 7)
                : 'Unknown';
            grouped.putIfAbsent(key, () => []).add(p);
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(paymentsProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: grouped.length,
              itemBuilder: (context, i) {
                final month = grouped.keys.elementAt(i);
                final payments = grouped[month]!;
                final monthTotal = payments.fold<double>(
                    0, (s, p) => s + p.amount);
                final label = _formatMonth(month);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(label,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 15)),
                          Text(
                            '₹${monthTotal.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{2})+(\d)(?!\d))'), (m) => '${m[1]},')}',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: ResIQTheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ...payments.map((p) => _PaymentTile(payment: p)),
                  ],
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddPaymentSheet(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Add Payment'),
      ),
    );
  }

  String _formatMonth(String yyyyMM) {
    try {
      final d = DateTime.parse('$yyyyMM-01');
      return DateFormat('MMMM yyyy').format(d);
    } catch (_) {
      return yyyyMM;
    }
  }

  void _showAddPaymentSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: _AddPaymentForm(onSaved: () {
          ref.invalidate(paymentsProvider);
          ref.invalidate(allReservationsProvider);
          Navigator.pop(ctx);
        }),
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Payment payment;
  const _PaymentTile({required this.payment});

  IconData _methodIcon() {
    switch (payment.paymentMethod.toLowerCase()) {
      case 'cash':
        return Icons.money;
      case 'upi':
        return Icons.qr_code;
      case 'bank_transfer':
      case 'neft':
      case 'imps':
        return Icons.account_balance;
      case 'card':
      case 'credit_card':
      case 'debit_card':
        return Icons.credit_card;
      default:
        return Icons.payment;
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = payment.paymentDate.isNotEmpty
        ? DateFormat('d MMM').format(DateTime.parse(payment.paymentDate))
        : '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ResIQTheme.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_methodIcon(), color: ResIQTheme.success, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(payment.bookingId,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(
                    '${payment.paymentMethod.replaceAll('_', ' ')} · $date',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '₹${payment.amount.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{2})+(\d)(?!\d))'), (m) => '${m[1]},')}',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 15,
                color: Color(0xFF059669),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddPaymentForm extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _AddPaymentForm({required this.onSaved});

  @override
  ConsumerState<_AddPaymentForm> createState() => _AddPaymentFormState();
}

class _AddPaymentFormState extends ConsumerState<_AddPaymentForm> {
  final _bookingId = TextEditingController();
  final _amount = TextEditingController();
  final _reference = TextEditingController();
  String _method = 'cash';
  bool _saving = false;

  final _methods = ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other'];

  Future<void> _save() async {
    if (_bookingId.text.trim().isEmpty || _amount.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Booking ID and amount are required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final svc = ref.read(paymentServiceProvider);
      await svc.save({
        'booking_id': _bookingId.text.trim(),
        'payment_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'amount': double.tryParse(_amount.text) ?? 0,
        'payment_method': _method,
        'reference_number':
            _reference.text.trim().isEmpty ? null : _reference.text.trim(),
      });
      await svc.recalculateStatus(_bookingId.text.trim());
      widget.onSaved();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: ResIQTheme.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _bookingId.dispose();
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Add Payment',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        const SizedBox(height: 16),
        TextField(
          controller: _bookingId,
          decoration: const InputDecoration(labelText: 'Booking ID *'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _amount,
          decoration: const InputDecoration(
              labelText: 'Amount (₹) *', prefixText: '₹ '),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _method,
          decoration: const InputDecoration(labelText: 'Payment Method'),
          items: _methods
              .map((m) => DropdownMenuItem(
                  value: m,
                  child: Text(m.replaceAll('_', ' ').toUpperCase())))
              .toList(),
          onChanged: (v) => setState(() => _method = v ?? 'cash'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _reference,
          decoration: const InputDecoration(
              labelText: 'Reference / UTR (optional)'),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('Save Payment'),
          ),
        ),
      ],
    );
  }
}
