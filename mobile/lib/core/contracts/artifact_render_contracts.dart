/// Public contracts for `/api/v1/artifact-executions/:id/render`.
///
/// The rendered document is **not** here — the manifest represents it
/// (`artifact_manifest_contracts.dart`). This file describes only the state of
/// the rendering process, which the backend owns end to end.
///
/// Additive fields are ignored to keep the mobile v1 parser forward-compatible.
library;

typedef JsonObject = Map<String, dynamic>;

/// Rendering lifecycle. The client reads it; it never writes it.
enum ArtifactRenderStatus {
  notRendered,
  pending,
  rendering,
  ready,
  failed,
  unknown;

  static ArtifactRenderStatus parse(String? value) => switch (value) {
    'NOT_RENDERED' => ArtifactRenderStatus.notRendered,
    'PENDING' => ArtifactRenderStatus.pending,
    'RENDERING' => ArtifactRenderStatus.rendering,
    'READY' => ArtifactRenderStatus.ready,
    'FAILED' => ArtifactRenderStatus.failed,
    _ => ArtifactRenderStatus.unknown,
  };

  /// Still moving — the client keeps checking.
  bool get isInFlight =>
      this == ArtifactRenderStatus.pending ||
      this == ArtifactRenderStatus.rendering;
}

class ArtifactRenderStateContract {
  const ArtifactRenderStateContract({
    required this.executionId,
    required this.renderStatus,
    required this.requestedAt,
    required this.startedAt,
    required this.completedAt,
    required this.error,
    required this.jobId,
    required this.correlationId,
  });

  factory ArtifactRenderStateContract.fromJson(JsonObject json) =>
      ArtifactRenderStateContract(
        executionId: json['executionId'] as String? ?? '',
        renderStatus: ArtifactRenderStatus.parse(
          json['renderStatus'] as String?,
        ),
        requestedAt: DateTime.tryParse(json['requestedAt'] as String? ?? ''),
        startedAt: DateTime.tryParse(json['startedAt'] as String? ?? ''),
        completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
        error: json['error'] as String?,
        jobId: json['jobId'] as String?,
        correlationId: json['correlationId'] as String?,
      );

  final String executionId;
  final ArtifactRenderStatus renderStatus;
  final DateTime? requestedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;

  /// Business-language reason; never a stack or an internal path.
  final String? error;

  /// Present on the request response; null when reading the state.
  final String? jobId;
  final String? correlationId;

  bool get isReady => renderStatus == ArtifactRenderStatus.ready;
  bool get hasFailed => renderStatus == ArtifactRenderStatus.failed;
}
