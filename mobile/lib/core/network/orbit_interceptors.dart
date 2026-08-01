/// Interceptors do cliente HTTP.
///
/// Cada um faz uma coisa só, na ordem em que o Dio os executa:
///
/// 1. [RequestContextInterceptor] — identifica e contextualiza a requisição;
/// 2. [AuthInterceptor] — anexa o token e renova a sessão no 401;
/// 3. [LoggingInterceptor] — registra sem vazar segredo;
/// 4. [ErrorMappingInterceptor] — traduz falhas para [OrbitException].
library;

import 'dart:math';

import 'package:dio/dio.dart';

import '../errors/orbit_exception.dart';
import '../observability/orbit_logger.dart';
import '../storage/token_storage.dart';
import 'session_authenticator.dart';

/// Marca requisições que não devem levar token nem disparar renovação.
const publicRequestKey = 'orbit.public';

/// Cabeçalhos de contexto — os mesmos nomes usados pela aplicação web.
abstract final class ContextHeaders {
  static const requestId = 'x-request-id';
  static const locale = 'accept-language';
  static const timezone = 'x-timezone';
  static const client = 'x-orbit-client';
}

/// Gera `x-request-id` e envia locale e timezone.
///
/// O `RequestIdInterceptor` do NestJS aceita o id que enviamos e o devolve na
/// resposta — é o que permite casar um erro no aparelho com o log do servidor.
class RequestContextInterceptor extends Interceptor {
  RequestContextInterceptor({required this.locale, required this.timezone});

  final String locale;
  final String timezone;

  static final _random = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers[ContextHeaders.requestId] ??= newRequestId();
    options.headers[ContextHeaders.locale] ??= locale;
    options.headers[ContextHeaders.timezone] ??= timezone;
    options.headers[ContextHeaders.client] ??= 'MOBILE';
    handler.next(options);
  }

  /// UUID v4 para correlação ponta a ponta.
  static String newRequestId() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}

/// Anexa o access token e renova a sessão quando o backend responde 401.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required TokenStorage storage,
    required SessionAuthenticator authenticator,
    required Dio retryClient,
  }) : _storage = storage,
       _authenticator = authenticator,
       _retryClient = retryClient;

  final TokenStorage _storage;
  final SessionAuthenticator _authenticator;

  /// Cliente sem este interceptor, para reexecutar sem recursão.
  final Dio _retryClient;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[publicRequestKey] == true) return handler.next(options);
    final tokens = await _storage.read();
    if (tokens != null) {
      options.headers['authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final isPublic = options.extra[publicRequestKey] == true;
    final alreadyRetried = options.extra['orbit.retried'] == true;

    if (err.response?.statusCode != 401 || isPublic || alreadyRetried) {
      return handler.next(err);
    }

    final tokens = await _storage.read();
    if (tokens == null) return handler.next(err);

    final renewed = await _authenticator.refresh(tokens.refreshToken);
    if (renewed == null) return handler.next(err);

    try {
      final response = await _retryClient.fetch<dynamic>(
        options
          ..headers['authorization'] = 'Bearer ${renewed.accessToken}'
          ..extra['orbit.retried'] = true,
      );
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }
}

/// Registra a requisição sem expor segredo.
class LoggingInterceptor extends Interceptor {
  LoggingInterceptor(this._logger);

  final OrbitLogger _logger;

  static const _startKey = 'orbit.startedAt';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.extra[_startKey] = DateTime.now();
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    _log(response.requestOptions, response.statusCode);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _log(err.requestOptions, err.response?.statusCode, error: err.type.name);
    handler.next(err);
  }

  void _log(RequestOptions options, int? status, {String? error}) {
    final startedAt = options.extra[_startKey];
    final duration = startedAt is DateTime
        ? DateTime.now().difference(startedAt).inMilliseconds
        : null;
    // Sem corpo, sem query com identificadores, sem cabeçalhos.
    _logger.info('http', data: {
      'method': options.method,
      'path': options.path,
      'status': status,
      'durationMs': duration,
      'requestId': options.headers[ContextHeaders.requestId],
      if (error != null) 'error': error,
    });
  }
}

/// Traduz qualquer falha do Dio para [OrbitException].
class ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    handler.reject(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: _map(err),
      ),
    );
  }

  OrbitException _map(DioException err) {
    final requestId =
        err.response?.headers.value(ContextHeaders.requestId) ??
        err.requestOptions.headers[ContextHeaders.requestId] as String?;

    return switch (err.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout => OrbitException(
        kind: OrbitErrorKind.timeout,
        message: 'O servidor demorou a responder.',
        code: 'TIMEOUT',
        requestId: requestId,
      ),
      DioExceptionType.cancel => OrbitException(
        kind: OrbitErrorKind.cancelled,
        message: 'Requisição cancelada.',
        code: 'CANCELLED',
        requestId: requestId,
      ),
      DioExceptionType.connectionError ||
      DioExceptionType.unknown when err.response == null => const OrbitException(
        kind: OrbitErrorKind.network,
        message: 'Sem conexão com o servidor.',
        code: 'NETWORK',
      ),
      _ => OrbitException.fromEnvelope(
        status: err.response?.statusCode ?? 0,
        body: err.response?.data,
        requestId: requestId,
      ),
    };
  }
}
