/// Public Artifact Template Engine contracts.
///
/// Mirrors `artifact-template.read-models.ts`. Parsers are intentionally
/// tolerant of additive fields so v1 remains forward-compatible on mobile.
library;

typedef JsonObject = Map<String, dynamic>;

class ArtifactFieldContract {
  const ArtifactFieldContract({
    required this.id,
    required this.label,
    required this.type,
    required this.order,
    required this.required,
    required this.configuration,
  });

  factory ArtifactFieldContract.fromJson(JsonObject json) =>
      ArtifactFieldContract(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        type: json['type'] as String? ?? '',
        order: (json['order'] as num?)?.toInt() ?? 0,
        required: json['required'] as bool? ?? false,
        configuration:
            json['configuration'] as JsonObject? ?? const <String, dynamic>{},
      );

  final String id;
  final String label;
  final String type;
  final int order;
  final bool required;
  final JsonObject configuration;
}

class ArtifactSectionContract {
  const ArtifactSectionContract({
    required this.id,
    required this.title,
    required this.type,
    required this.order,
    required this.fields,
  });

  factory ArtifactSectionContract.fromJson(JsonObject json) =>
      ArtifactSectionContract(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        type: json['type'] as String? ?? '',
        order: (json['order'] as num?)?.toInt() ?? 0,
        fields: (json['fields'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .map(ArtifactFieldContract.fromJson)
            .toList(growable: false),
      );

  final String id;
  final String title;
  final String type;
  final int order;
  final List<ArtifactFieldContract> fields;
}

class ArtifactTemplateVersionContract {
  const ArtifactTemplateVersionContract({
    required this.id,
    required this.version,
    required this.sections,
    required this.signatures,
    required this.layout,
  });

  factory ArtifactTemplateVersionContract.fromJson(JsonObject json) =>
      ArtifactTemplateVersionContract(
        id: json['id'] as String? ?? '',
        version: (json['version'] as num?)?.toInt() ?? 0,
        sections: (json['sections'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .map(ArtifactSectionContract.fromJson)
            .toList(growable: false),
        signatures: (json['signatureSlots'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .toList(growable: false),
        layout: json['layout'] as JsonObject? ?? const <String, dynamic>{},
      );

  final String id;
  final int version;
  final List<ArtifactSectionContract> sections;
  final List<JsonObject> signatures;
  final JsonObject layout;
}

class ArtifactTemplateContract {
  const ArtifactTemplateContract({
    required this.id,
    required this.key,
    required this.name,
    required this.artifactType,
    required this.status,
    required this.currentVersion,
    required this.current,
  });

  factory ArtifactTemplateContract.fromJson(JsonObject json) =>
      ArtifactTemplateContract(
        id: json['id'] as String? ?? '',
        key: json['key'] as String? ?? '',
        name: json['name'] as String? ?? '',
        artifactType: json['artifactType'] as String? ?? '',
        status: json['status'] as String? ?? '',
        currentVersion: (json['currentVersion'] as num?)?.toInt() ?? 0,
        current: ArtifactTemplateVersionContract.fromJson(
          json['current'] as JsonObject? ?? const <String, dynamic>{},
        ),
      );

  final String id;
  final String key;
  final String name;
  final String artifactType;
  final String status;
  final int currentVersion;
  final ArtifactTemplateVersionContract current;
}
