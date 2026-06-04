class Property {
  final int id;
  final String name;
  final String? location;
  final String? type;
  final int? capacity;
  final double? revenueSharePercent;
  final String? ownerId;

  Property({
    required this.id,
    required this.name,
    this.location,
    this.type,
    this.capacity,
    this.revenueSharePercent,
    this.ownerId,
  });

  factory Property.fromJson(Map<String, dynamic> json) {
    return Property(
      id: json['id'],
      name: json['name'] ?? '',
      location: json['location'],
      type: json['type'],
      capacity: json['capacity'],
      revenueSharePercent: (json['revenue_share_percent'] as num?)?.toDouble(),
      ownerId: json['owner_id']?.toString(),
    );
  }
}
