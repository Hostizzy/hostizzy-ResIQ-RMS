class GuestDocument {
  final int id;
  final String bookingId;
  final String? guestName;
  final String? documentType;
  final String? documentUrl;
  final String? selfieUrl;
  final String status; // pending, verified, rejected
  final DateTime? submittedAt;
  // Joined from reservation
  final String? propertyName;
  final String? guestPhone;

  GuestDocument({
    required this.id,
    required this.bookingId,
    this.guestName,
    this.documentType,
    this.documentUrl,
    this.selfieUrl,
    required this.status,
    this.submittedAt,
    this.propertyName,
    this.guestPhone,
  });

  factory GuestDocument.fromJson(Map<String, dynamic> json) {
    return GuestDocument(
      id: json['id'],
      bookingId: json['booking_id'] ?? '',
      guestName: json['guest_name'],
      documentType: json['document_type'],
      documentUrl: json['document_url'],
      selfieUrl: json['selfie_url'],
      status: json['status'] ?? 'pending',
      submittedAt: json['submitted_at'] != null
          ? DateTime.tryParse(json['submitted_at'])
          : null,
      propertyName: json['property_name'],
      guestPhone: json['guest_phone'],
    );
  }
}
