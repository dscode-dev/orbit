/// Erros normalizados da API.
///
/// Toda falha — rede, timeout, cancelamento ou resposta não-2xx — chega às
/// camadas superiores como [OrbitException], com `status`, `code` e
/// `requestId` preenchidos sempre que o backend os fornecer.
///
/// O formato de erro é o do `FoundationExceptionFilter` do NestJS:
/// `{ success: false, error: { code, message, details }, requestId, timestamp }`.
library;

enum OrbitErrorKind { http, network, timeout, cancelled, parse, unauthorized }

class OrbitException implements Exception {
  const OrbitException({
    required this.kind,
    required this.message,
    this.status = 0,
    this.code = 'UNKNOWN',
    this.requestId,
    this.details,
  });

  final OrbitErrorKind kind;
  final String message;
  final int status;
  final String code;
  final String? requestId;
  final Object? details;

  bool get isUnauthorized =>
      status == 401 || kind == OrbitErrorKind.unauthorized;
  bool get isForbidden => status == 403;
  bool get isNotFound => status == 404;
  bool get isConflict => status == 409;
  bool get isValidation => status == 400 || status == 422;
  bool get isServer => status >= 500;
  bool get isOffline => kind == OrbitErrorKind.network;

  /// Mensagens de validação do `ValidationPipe` (array de strings).
  List<String> get validationMessages {
    final value = details;
    if (value is List) {
      return value.whereType<String>().toList(growable: false);
    }
    return const [];
  }

  /// Interpreta o corpo de erro do backend.
  factory OrbitException.fromEnvelope({
    required int status,
    required Object? body,
    String? requestId,
  }) {
    const fallback = 'Não foi possível concluir a solicitação.';
    if (body is! Map) {
      return OrbitException(
        kind: OrbitErrorKind.http,
        status: status,
        message: fallback,
        code: _defaultCode(status),
        requestId: requestId,
      );
    }
    final error = body['error'];
    final rawMessage = error is Map ? error['message'] : body['message'];
    final message = switch (rawMessage) {
      final String value => value,
      final List<dynamic> values => values.whereType<String>().join(' '),
      _ => fallback,
    };
    return OrbitException(
      kind: OrbitErrorKind.http,
      status: status,
      message: message.isEmpty ? fallback : message,
      code:
          (error is Map ? error['code'] as String? : null) ??
          _defaultCode(status),
      requestId: (body['requestId'] as String?) ?? requestId,
      details: error is Map ? error['details'] ?? rawMessage : rawMessage,
    );
  }

  static String _defaultCode(int status) => switch (status) {
    401 => 'UNAUTHORIZED',
    403 => 'FORBIDDEN',
    404 => 'NOT_FOUND',
    409 => 'CONFLICT',
    429 => 'TOO_MANY_REQUESTS',
    _ => status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR',
  };

  @override
  String toString() => 'OrbitException($code, status: $status): $message';
}
