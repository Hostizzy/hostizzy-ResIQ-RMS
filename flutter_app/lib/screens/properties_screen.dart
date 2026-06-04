import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/supabase_client.dart';
import '../core/theme.dart';
import '../models/property.dart';
import '../providers/properties_provider.dart';
import '../widgets/shimmer_card.dart';

class PropertiesScreen extends ConsumerWidget {
  const PropertiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final properties = ref.watch(propertiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Properties',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
      ),
      body: properties.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(4, (_) => const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: ShimmerCard(height: 110),
          )),
        ),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.villa_outlined,
                      size: 48,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurfaceVariant
                          .withOpacity(0.3)),
                  const SizedBox(height: 12),
                  const Text('No properties yet'),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () => _showAddProperty(context, ref),
                    icon: const Icon(Icons.add),
                    label: const Text('Add Property'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(propertiesProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              itemCount: list.length,
              itemBuilder: (ctx, i) => _PropertyCard(property: list[i]),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddProperty(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddProperty(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: _AddPropertyForm(onSaved: () {
          ref.invalidate(propertiesProvider);
          Navigator.pop(ctx);
        }),
      ),
    );
  }
}

class _PropertyCard extends StatelessWidget {
  final Property property;
  const _PropertyCard({required this.property});

  IconData _typeIcon() {
    switch (property.type?.toLowerCase()) {
      case 'villa':
        return Icons.villa;
      case 'farmhouse':
        return Icons.agriculture;
      case 'apartment':
        return Icons.apartment;
      case 'cottage':
        return Icons.cottage;
      case 'homestay':
        return Icons.home;
      default:
        return Icons.villa_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: ResIQTheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_typeIcon(), color: ResIQTheme.primary, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(property.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 4),
                  if (property.location != null)
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined,
                            size: 14,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(property.location!,
                              style: TextStyle(
                                fontSize: 13,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                              overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (property.capacity != null)
                        _InfoChip(
                            icon: Icons.people_outline,
                            text: '${property.capacity} guests'),
                      if (property.type != null) ...[
                        const SizedBox(width: 8),
                        _InfoChip(
                            icon: _typeIcon(),
                            text: property.type!
                                .replaceAll('_', ' ')
                                .toUpperCase()),
                      ],
                      if (property.revenueSharePercent != null) ...[
                        const SizedBox(width: 8),
                        _InfoChip(
                            icon: Icons.percent,
                            text:
                                '${property.revenueSharePercent!.round()}% commission'),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon,
              size: 11,
              color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 4),
          Text(text,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              )),
        ],
      ),
    );
  }
}

class _AddPropertyForm extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  const _AddPropertyForm({required this.onSaved});

  @override
  ConsumerState<_AddPropertyForm> createState() => _AddPropertyFormState();
}

class _AddPropertyFormState extends ConsumerState<_AddPropertyForm> {
  final _name = TextEditingController();
  final _location = TextEditingController();
  final _capacity = TextEditingController(text: '4');
  final _commission = TextEditingController(text: '0');
  String _type = 'villa';
  bool _saving = false;

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Property name is required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await supabase.from('properties').insert({
        'name': _name.text.trim(),
        'location': _location.text.trim().isEmpty
            ? 'Not specified'
            : _location.text.trim(),
        'type': _type,
        'capacity': int.tryParse(_capacity.text) ?? 4,
        'revenue_share_percent':
            double.tryParse(_commission.text) ?? 0,
      });
      widget.onSaved();
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
    _name.dispose();
    _location.dispose();
    _capacity.dispose();
    _commission.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Add Property',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Property Name *'),
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _location,
          decoration: const InputDecoration(labelText: 'Location'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: 'villa', child: Text('Villa')),
                  DropdownMenuItem(value: 'farmhouse', child: Text('Farmhouse')),
                  DropdownMenuItem(value: 'cottage', child: Text('Cottage')),
                  DropdownMenuItem(value: 'apartment', child: Text('Apartment')),
                  DropdownMenuItem(value: 'homestay', child: Text('Homestay')),
                ],
                onChanged: (v) => setState(() => _type = v ?? 'villa'),
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 100,
              child: TextField(
                controller: _capacity,
                decoration: const InputDecoration(labelText: 'Capacity'),
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _commission,
          decoration: const InputDecoration(
            labelText: 'Commission %',
            suffixText: '%',
          ),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                : const Text('Add Property'),
          ),
        ),
      ],
    );
  }
}
