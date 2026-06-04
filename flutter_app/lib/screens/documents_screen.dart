import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';
import '../models/guest_document.dart';
import '../providers/documents_provider.dart';
import '../widgets/shimmer_card.dart';

final _filterProvider = StateProvider<String?>((_) => null);

class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docs = ref.watch(guestDocumentsProvider);
    final filter = ref.watch(_filterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest Documents',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
        actions: [
          PopupMenuButton<String?>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) => ref.read(_filterProvider.notifier).state = v,
            itemBuilder: (_) => [
              const PopupMenuItem(value: null, child: Text('All')),
              const PopupMenuItem(value: 'pending', child: Text('Pending')),
              const PopupMenuItem(value: 'verified', child: Text('Verified')),
              const PopupMenuItem(value: 'rejected', child: Text('Rejected')),
            ],
          ),
        ],
      ),
      body: docs.when(
        loading: () => ListView(
          padding: const EdgeInsets.all(16),
          children: List.generate(6, (_) => const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: ShimmerCard(height: 90),
          )),
        ),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (list) {
          var filtered = filter != null
              ? list.where((d) => d.status == filter).toList()
              : list;

          if (filtered.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.file_copy_outlined,
                      size: 48,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurfaceVariant
                          .withOpacity(0.3)),
                  const SizedBox(height: 12),
                  const Text('No documents to review'),
                ],
              ),
            );
          }

          final pending = list.where((d) => d.status == 'pending').length;
          final verified = list.where((d) => d.status == 'verified').length;

          return Column(
            children: [
              // Stats bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    _StatChip(
                        label: 'Pending', count: pending, color: ResIQTheme.warning),
                    const SizedBox(width: 8),
                    _StatChip(
                        label: 'Verified', count: verified, color: ResIQTheme.success),
                    const SizedBox(width: 8),
                    _StatChip(
                        label: 'Total',
                        count: list.length,
                        color: ResIQTheme.primary),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(guestDocumentsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) =>
                        _DocumentCard(doc: filtered[i]),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  const _StatChip(
      {required this.label, required this.count, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text('$count $label',
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          )),
    );
  }
}

class _DocumentCard extends ConsumerWidget {
  final GuestDocument doc;
  const _DocumentCard({required this.doc});

  Color _statusColor() {
    switch (doc.status) {
      case 'verified':
        return ResIQTheme.success;
      case 'rejected':
        return ResIQTheme.danger;
      default:
        return ResIQTheme.warning;
    }
  }

  String _statusIcon() {
    switch (doc.status) {
      case 'verified':
        return '✓';
      case 'rejected':
        return '✕';
      default:
        return '⏳';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submitted = doc.submittedAt != null
        ? DateFormat('d MMM, h:mm a').format(doc.submittedAt!)
        : '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showDetail(context, ref),
        child: Container(
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: _statusColor(), width: 4)),
          ),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              // Thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: doc.selfieUrl != null
                    ? CachedNetworkImage(
                        imageUrl: doc.selfieUrl!,
                        width: 48,
                        height: 48,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          width: 48,
                          height: 48,
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                        ),
                        errorWidget: (_, __, ___) => _placeholderAvatar(context),
                      )
                    : _placeholderAvatar(context),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doc.guestName ?? doc.bookingId,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(
                      '${doc.propertyName ?? '-'} · $submitted',
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor().withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${_statusIcon()} ${doc.status.toUpperCase()}',
                  style: TextStyle(
                    color: _statusColor(),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placeholderAvatar(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Icon(Icons.person, size: 24,
          color: Theme.of(context).colorScheme.onSurfaceVariant),
    );
  }

  void _showDetail(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.8,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        expand: false,
        builder: (ctx, scroll) => _DocumentDetail(
          doc: doc,
          scrollController: scroll,
          onStatusChanged: () {
            ref.invalidate(guestDocumentsProvider);
            Navigator.pop(ctx);
          },
        ),
      ),
    );
  }
}

class _DocumentDetail extends ConsumerWidget {
  final GuestDocument doc;
  final ScrollController scrollController;
  final VoidCallback onStatusChanged;

  const _DocumentDetail({
    required this.doc,
    required this.scrollController,
    required this.onStatusChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outline,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(doc.guestName ?? 'Guest',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        const SizedBox(height: 4),
        Text('${doc.bookingId} · ${doc.propertyName ?? '-'}',
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant)),
        const SizedBox(height: 20),

        // Document image
        if (doc.documentUrl != null) ...[
          const Text('ID Document',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: doc.documentUrl!,
              fit: BoxFit.contain,
              placeholder: (_, __) => const SizedBox(
                  height: 200,
                  child: Center(child: CircularProgressIndicator())),
              errorWidget: (_, __, ___) => Container(
                height: 200,
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: const Center(child: Text('Failed to load image')),
              ),
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Selfie
        if (doc.selfieUrl != null) ...[
          const Text('Selfie',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: doc.selfieUrl!,
              height: 200,
              fit: BoxFit.cover,
              placeholder: (_, __) => const SizedBox(
                  height: 200,
                  child: Center(child: CircularProgressIndicator())),
            ),
          ),
          const SizedBox(height: 20),
        ],

        Text('Document type: ${doc.documentType ?? 'Not specified'}',
            style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 13)),
        const SizedBox(height: 24),

        // Action buttons
        if (doc.status == 'pending') ...[
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await ref
                        .read(documentServiceProvider)
                        .updateStatus(doc.id, 'verified');
                    onStatusChanged();
                  },
                  icon: const Icon(Icons.check),
                  label: const Text('Approve'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ResIQTheme.success,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await ref
                        .read(documentServiceProvider)
                        .updateStatus(doc.id, 'rejected');
                    onStatusChanged();
                  },
                  icon: const Icon(Icons.close),
                  label: const Text('Reject'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ResIQTheme.danger,
                    side: const BorderSide(color: ResIQTheme.danger),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ] else
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: doc.status == 'verified'
                  ? const Color(0xFFDCFCE7)
                  : const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              doc.status == 'verified'
                  ? '✓ Document verified'
                  : '✕ Document rejected',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: doc.status == 'verified'
                    ? const Color(0xFF166534)
                    : const Color(0xFF991B1B),
              ),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }
}
