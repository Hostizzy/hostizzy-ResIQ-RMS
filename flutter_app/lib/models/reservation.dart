class Reservation {
  final int? id;
  final String bookingId;
  final int propertyId;
  final String? propertyName;
  final String guestName;
  final String guestPhone;
  final String? guestEmail;
  final String? guestCity;
  final String checkIn;
  final String checkOut;
  final int nights;
  final int adults;
  final int kids;
  final String status;
  final String? bookingSource;
  final String? bookingType;
  final double stayAmount;
  final double extraGuestCharges;
  final double mealsChef;
  final double bonfireOther;
  final double taxes;
  final double totalAmount;
  final double paidAmount;
  final String paymentStatus;
  final double? hostizzyRevenue;
  final double? otaServiceFee;
  final String? kycStatus;
  final DateTime? createdAt;

  Reservation({
    this.id,
    required this.bookingId,
    required this.propertyId,
    this.propertyName,
    required this.guestName,
    required this.guestPhone,
    this.guestEmail,
    this.guestCity,
    required this.checkIn,
    required this.checkOut,
    required this.nights,
    this.adults = 2,
    this.kids = 0,
    this.status = 'confirmed',
    this.bookingSource = 'DIRECT',
    this.bookingType = 'STAYCATION',
    this.stayAmount = 0,
    this.extraGuestCharges = 0,
    this.mealsChef = 0,
    this.bonfireOther = 0,
    this.taxes = 0,
    this.totalAmount = 0,
    this.paidAmount = 0,
    this.paymentStatus = 'pending',
    this.hostizzyRevenue,
    this.otaServiceFee,
    this.kycStatus,
    this.createdAt,
  });

  factory Reservation.fromJson(Map<String, dynamic> json) {
    return Reservation(
      id: json['id'],
      bookingId: json['booking_id'] ?? '',
      propertyId: json['property_id'] ?? 0,
      propertyName: json['property_name'],
      guestName: json['guest_name'] ?? '',
      guestPhone: json['guest_phone'] ?? '',
      guestEmail: json['guest_email'],
      guestCity: json['guest_city'],
      checkIn: json['check_in'] ?? '',
      checkOut: json['check_out'] ?? '',
      nights: json['nights'] ?? 0,
      adults: json['adults'] ?? 2,
      kids: json['kids'] ?? 0,
      status: json['status'] ?? 'confirmed',
      bookingSource: json['booking_source'],
      bookingType: json['booking_type'],
      stayAmount: (json['stay_amount'] ?? 0).toDouble(),
      extraGuestCharges: (json['extra_guest_charges'] ?? 0).toDouble(),
      mealsChef: (json['meals_chef'] ?? 0).toDouble(),
      bonfireOther: (json['bonfire_other'] ?? 0).toDouble(),
      taxes: (json['taxes'] ?? 0).toDouble(),
      totalAmount: (json['total_amount'] ?? 0).toDouble(),
      paidAmount: (json['paid_amount'] ?? 0).toDouble(),
      paymentStatus: json['payment_status'] ?? 'pending',
      hostizzyRevenue: (json['hostizzy_revenue'] as num?)?.toDouble(),
      otaServiceFee: (json['ota_service_fee'] as num?)?.toDouble(),
      kycStatus: json['kyc_status'],
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'booking_id': bookingId,
      'property_id': propertyId,
      'property_name': propertyName,
      'guest_name': guestName,
      'guest_phone': guestPhone,
      'guest_email': guestEmail,
      'guest_city': guestCity,
      'check_in': checkIn,
      'check_out': checkOut,
      'nights': nights,
      'adults': adults,
      'kids': kids,
      'status': status,
      'booking_source': bookingSource,
      'booking_type': bookingType,
      'stay_amount': stayAmount,
      'extra_guest_charges': extraGuestCharges,
      'meals_chef': mealsChef,
      'bonfire_other': bonfireOther,
      'taxes': taxes,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'payment_status': paymentStatus,
      'hostizzy_revenue': hostizzyRevenue,
      'ota_service_fee': otaServiceFee,
    };
  }

  double get balance => totalAmount - paidAmount;
  bool get isPaid => paymentStatus == 'paid';
  bool get isCancelled => status == 'cancelled';
}
