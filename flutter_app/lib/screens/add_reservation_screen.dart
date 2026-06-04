import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/property.dart';
import '../models/reservation.dart';
import '../providers/properties_provider.dart';
import '../providers/reservations_provider.dart';

class AddReservationScreen extends ConsumerStatefulWidget {
  final String? reservationId;

  const AddReservationScreen({super.key, this.reservationId});

  @override
  ConsumerState<AddReservationScreen> createState() =>
      _AddReservationScreenState();
}

class _AddReservationScreenState extends ConsumerState<AddReservationScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  // Guest
  final _guestName = TextEditingController();
  final _guestPhone = TextEditingController();
  final _guestEmail = TextEditingController();

  // Booking
  int? _propertyId;
  String? _propertyName;
  DateTime? _checkIn;
  DateTime? _checkOut;
  final _adults = TextEditingController(text: '2');

  // Pricing
  final _stayAmount = TextEditingController(text: '0');

  bool get _isEditing => widget.reservationId != null;
  Reservation? _existing;

  @override
  void initState() {
    super.initState();
    if (_isEditing) _loadExisting();
  }

  Future<void> _loadExisting() async {
    final r = await ref
        .read(reservationByIdProvider(widget.reservationId!).future);
    if (r == null || !mounted) return;

    setState(() {
      _existing = r;
      _guestName.text = r.guestName;
      _guestPhone.text = r.guestPhone;
      _guestEmail.text = r.guestEmail ?? '';
      _propertyId = r.propertyId;
      _propertyName = r.propertyName;
      _checkIn = DateTime.tryParse(r.checkIn);
      _checkOut = DateTime.tryParse(r.checkOut);
      _adults.text = r.adults.toString();
      _stayAmount.text = r.stayAmount.round().toString();
    });
  }

  int get _nights {
    if (_checkIn == null || _checkOut == null) return 0;
    return _checkOut!.difference(_checkIn!).inDays;
  }

  Future<void> _pickDate(bool isCheckIn) async {
    final initial = isCheckIn
        ? (_checkIn ?? DateTime.now())
        : (_checkOut ?? (_checkIn ?? DateTime.now()).add(const Duration(days: 1)));

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );

    if (picked == null) return;
    setState(() {
      if (isCheckIn) {
        _checkIn = picked;
        if (_checkOut != null && _checkOut!.isBefore(picked)) {
          _checkOut = picked.add(const Duration(days: 1));
        }
      } else {
        _checkOut = picked;
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_propertyId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select a property')));
      return;
    }
    if (_checkIn == null || _checkOut == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select check-in and check-out dates')));
      return;
    }

    setState(() => _saving = true);

    try {
      final stayAmount = double.tryParse(_stayAmount.text) ?? 0;
      final nights = _nights;
      final perNight = nights > 0 ? stayAmount / nights : 0;
      final taxRate = perNight <= 7500 ? 0.05 : 0.18;
      final taxes = (stayAmount * taxRate * 100).round() / 100;
      final totalAmount = stayAmount + taxes;

      final data = {
        if (_existing?.id != null) 'id': _existing!.id,
        'booking_id': _existing?.bookingId ??
            'BK${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}',
        'property_id': _propertyId,
        'property_name': _propertyName,
        'guest_name': _guestName.text.trim(),
        'guest_phone': _guestPhone.text.trim(),
        'guest_email':
            _guestEmail.text.trim().isEmpty ? null : _guestEmail.text.trim(),
        'check_in': DateFormat('yyyy-MM-dd').format(_checkIn!),
        'check_out': DateFormat('yyyy-MM-dd').format(_checkOut!),
        'nights': nights,
        'adults': int.tryParse(_adults.text) ?? 2,
        'kids': 0,
        'number_of_guests': int.tryParse(_adults.text) ?? 2,
        'status': _existing?.status ?? 'confirmed',
        'booking_source': _existing?.bookingSource ?? 'DIRECT',
        'booking_type': _existing?.bookingType ?? 'STAYCATION',
        'stay_amount': stayAmount,
        'extra_guest_charges': 0,
        'meals_chef': 0,
        'bonfire_other': 0,
        'taxes': taxes,
        'gst_status': 'gst',
        'total_amount_pre_tax': stayAmount,
        'total_amount_inc_tax': stayAmount + taxes,
        'total_amount': totalAmount,
        'damages': 0,
        'booking_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'month': DateFormat('MMM yyyy').format(_checkIn!),
        'paid_amount': _existing?.paidAmount ?? 0,
        'payment_status': _existing?.paymentStatus ?? 'pending',
        'is_legacy': false,
      };

      await ref.read(reservationServiceProvider).save(data);

      ref.invalidate(allReservationsProvider);
      ref.invalidate(reservationsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_isEditing ? 'Reservation updated' : 'Reservation created'),
          backgroundColor: ResIQTheme.success,
        ));
        context.go('/reservations');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: ResIQTheme.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _guestName.dispose();
    _guestPhone.dispose();
    _guestEmail.dispose();
    _adults.dispose();
    _stayAmount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final properties = ref.watch(propertiesProvider);
    final dateFormat = DateFormat('d MMM yyyy');

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit Reservation' : 'New Reservation',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/reservations'),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Section: Guest ──
            _SectionHeader(title: 'Guest', icon: Icons.person_outline),
            const SizedBox(height: 12),
            TextFormField(
              controller: _guestName,
              decoration: const InputDecoration(labelText: 'Guest Name *'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _guestPhone,
              decoration: const InputDecoration(labelText: 'Phone *'),
              keyboardType: TextInputType.phone,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _guestEmail,
              decoration: const InputDecoration(labelText: 'Email (optional)'),
              keyboardType: TextInputType.emailAddress,
            ),

            const SizedBox(height: 28),

            // ── Section: Booking ──
            _SectionHeader(title: 'Booking', icon: Icons.calendar_month_outlined),
            const SizedBox(height: 12),

            // Property dropdown
            properties.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error loading properties: $e'),
              data: (props) => DropdownButtonFormField<int>(
                value: _propertyId,
                decoration: const InputDecoration(labelText: 'Property *'),
                items: props
                    .map((p) =>
                        DropdownMenuItem(value: p.id, child: Text(p.name)))
                    .toList(),
                onChanged: (v) {
                  final p = props.firstWhere((p) => p.id == v);
                  setState(() {
                    _propertyId = v;
                    _propertyName = p.name;
                  });
                },
                validator: (v) => v == null ? 'Select a property' : null,
              ),
            ),
            const SizedBox(height: 12),

            // Date pickers
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => _pickDate(true),
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Check-in *'),
                      child: Text(
                        _checkIn != null ? dateFormat.format(_checkIn!) : 'Select',
                        style: TextStyle(
                          color: _checkIn != null
                              ? null
                              : Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => _pickDate(false),
                    child: InputDecorator(
                      decoration:
                          const InputDecoration(labelText: 'Check-out *'),
                      child: Text(
                        _checkOut != null
                            ? dateFormat.format(_checkOut!)
                            : 'Select',
                        style: TextStyle(
                          color: _checkOut != null
                              ? null
                              : Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (_nights > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('$_nights night${_nights > 1 ? 's' : ''}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: ResIQTheme.primary,
                    )),
              ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _adults,
              decoration: const InputDecoration(labelText: 'Adults'),
              keyboardType: TextInputType.number,
            ),

            const SizedBox(height: 28),

            // ── Section: Pricing ──
            _SectionHeader(title: 'Pricing', icon: Icons.currency_rupee),
            const SizedBox(height: 12),
            TextFormField(
              controller: _stayAmount,
              decoration: const InputDecoration(
                labelText: 'Stay Amount (₹)',
                prefixText: '₹ ',
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
            if (_nights > 0 &&
                (double.tryParse(_stayAmount.text) ?? 0) > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '₹${((double.tryParse(_stayAmount.text) ?? 0) / _nights).round()}/night · GST ${((double.tryParse(_stayAmount.text) ?? 0) / _nights) <= 7500 ? '5%' : '18%'} auto-applied',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),

            const SizedBox(height: 32),

            // Save button
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check),
                label: Text(_isEditing ? 'Update Reservation' : 'Save Reservation'),
              ),
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;

  const _SectionHeader({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: ResIQTheme.primary),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 16,
            )),
      ],
    );
  }
}
