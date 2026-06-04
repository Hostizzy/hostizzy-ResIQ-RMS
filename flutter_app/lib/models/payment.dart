class Payment {
  final int? id;
  final String bookingId;
  final String paymentDate;
  final double amount;
  final String paymentMethod;
  final String? paymentRecipient;
  final String? referenceNumber;
  final String? notes;
  final String? createdBy;
  final DateTime? createdAt;

  Payment({
    this.id,
    required this.bookingId,
    required this.paymentDate,
    required this.amount,
    required this.paymentMethod,
    this.paymentRecipient,
    this.referenceNumber,
    this.notes,
    this.createdBy,
    this.createdAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'],
      bookingId: json['booking_id'] ?? '',
      paymentDate: json['payment_date'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      paymentMethod: json['payment_method'] ?? '',
      paymentRecipient: json['payment_recipient'],
      referenceNumber: json['reference_number'],
      notes: json['notes'],
      createdBy: json['created_by'],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    if (id != null) 'id': id,
    'booking_id': bookingId,
    'payment_date': paymentDate,
    'amount': amount,
    'payment_method': paymentMethod,
    'payment_recipient': paymentRecipient,
    'reference_number': referenceNumber,
    'notes': notes,
    'created_by': createdBy,
  };
}
